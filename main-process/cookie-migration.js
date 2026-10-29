const fs = require('node:fs');
const path = require('node:path');

const BACKUP_SUFFIX = '.electron29-backup';
const COMPATIBILITY_BACKUP_SUFFIX = '.electron44-backup';

// Chromium 152's v24 schema, with defaults for fields omitted by Chromium 122.
// This compatibility is limited to plaintext, unpartitioned cookies.
const COOKIE_COLUMNS = `creation_utc INTEGER NOT NULL, host_key TEXT NOT NULL,
  top_frame_site_key TEXT NOT NULL, name TEXT NOT NULL, value TEXT NOT NULL,
  encrypted_value BLOB NOT NULL, path TEXT NOT NULL, expires_utc INTEGER NOT NULL,
  is_secure INTEGER NOT NULL, is_httponly INTEGER NOT NULL, last_access_utc INTEGER NOT NULL,
  has_expires INTEGER NOT NULL, is_persistent INTEGER NOT NULL, priority INTEGER NOT NULL,
  samesite INTEGER NOT NULL, source_scheme INTEGER NOT NULL, source_port INTEGER NOT NULL,
  last_update_utc INTEGER NOT NULL, source_type INTEGER NOT NULL DEFAULT 0,
  has_cross_site_ancestor INTEGER NOT NULL DEFAULT 1`;

function createCompatibleSchema(db) {
  db.exec(`CREATE TABLE cookies (${COOKIE_COLUMNS});
    CREATE UNIQUE INDEX cookies_unique_index ON cookies
      (host_key, top_frame_site_key, has_cross_site_ancestor, name, path, source_scheme, source_port);
    INSERT OR REPLACE INTO meta (key, value) VALUES ('version', '24'), ('last_compatible_version', '21');`);
}

function rebuildCompatibleSchema(db, preserveRows) {
  db.exec('BEGIN IMMEDIATE');
  try {
    if (preserveRows) {
      const expected = COOKIE_COLUMNS.split(',').map(column => column.trim().split(' ')[0]).sort();
      const actual = db.prepare('PRAGMA table_info(cookies)').all().map(column => column.name).sort();
      if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error('Unexpected Cookie v24 columns');
      const extraObjects = db.prepare(`SELECT name FROM sqlite_master WHERE tbl_name = 'cookies'
        AND type IN ('index', 'trigger') AND name != 'cookies_unique_index'`).all();
      if (extraObjects.length) throw new Error('Unexpected Cookie indexes or triggers');
    }
    db.exec('ALTER TABLE cookies RENAME TO cookies_before_compatibility; DROP INDEX IF EXISTS cookies_unique_index');
    createCompatibleSchema(db);
    if (preserveRows) {
      const columns = COOKIE_COLUMNS.split(',').map(column => column.trim().split(' ')[0]).join(', ');
      // Chromium uses true for unpartitioned cookies too. Otherwise v44 reads
      // v29's writes but cannot update/delete them with its full unique key.
      const values = columns.replace('has_cross_site_ancestor',
        "CASE WHEN top_frame_site_key = '' THEN 1 ELSE has_cross_site_ancestor END");
      db.exec(`INSERT INTO cookies (${columns}) SELECT ${values} FROM cookies_before_compatibility`);
    }
    db.exec('DROP TABLE cookies_before_compatibility; COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function prepareCookieMigration(databasePath, clearCookies = false) {
  const backupPath = databasePath + BACKUP_SUFFIX;
  if (clearCookies) {
    fs.rmSync(backupPath, { force: true });
    fs.rmSync(databasePath + COMPATIBILITY_BACKUP_SUFFIX, { force: true });
    // Clear before Chromium opens the DB, then create the compatible schema again.
    for (const suffix of ['', '-journal', '-wal', '-shm']) fs.rmSync(databasePath + suffix, { force: true });
  }

  const { DatabaseSync } = require('node:sqlite');
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  const db = new DatabaseSync(databasePath);
  try {
    // Chromium may leave an initialized but empty SQLite file after switching versions.
    if (!db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' LIMIT 1").get()) {
      db.exec('BEGIN IMMEDIATE; CREATE TABLE meta (key LONGVARCHAR NOT NULL UNIQUE PRIMARY KEY, value LONGVARCHAR)');
      try {
        createCompatibleSchema(db);
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    }
    const version = Number(db.prepare("SELECT value FROM meta WHERE key = 'version'").get()?.value);
    if (version === 24) {
      const columns = db.prepare('PRAGMA table_info(cookies)').all();
      const compatible = Number(db.prepare("SELECT value FROM meta WHERE key = 'last_compatible_version'").get()?.value) === 21 &&
        [['source_type', '0'], ['has_cross_site_ancestor', '1']].every(([name, defaultValue]) =>
          columns.some(column => column.name === name && String(column.dflt_value) === defaultValue));
      if (!compatible) {
        const compatibilityBackupPath = databasePath + COMPATIBILITY_BACKUP_SUFFIX;
        if (!fs.existsSync(compatibilityBackupPath)) db.prepare('VACUUM INTO ?').run(compatibilityBackupPath);
        rebuildCompatibleSchema(db, true);
        fs.unlinkSync(compatibilityBackupPath);
      }
    }
    if (fs.existsSync(backupPath)) {
      if (version === 21) throw new Error('Previous Cookie migration failed; refusing to overwrite the retained backup');
      return { status: 'previous-failure', backupPath };
    }
    if (version !== 21) return null;
    // VACUUM includes committed WAL contents and creates a standalone, consistent backup.
    db.prepare('VACUUM INTO ?').run(backupPath);
    const statement = db.prepare('SELECT * FROM cookies');
    statement.setReadBigInts(true);
    const rows = statement.all();
    // Import supported cookies through Electron's API into an already compatible DB.
    rebuildCompatibleSchema(db, false);
    return { status: 'prepared', backupPath, rows };
  } finally {
    db.close();
  }
}

function toCookie(row, now) {
  if (row.encrypted_value.length || row.top_frame_site_key) return { unsupported: true };
  const expirationDate = Number(row.expires_utc) / 1000000 - 11644473600;
  if (Number(row.has_expires) && expirationDate <= now) return { expired: true };
  const sameSite = { '-1': 'unspecified', 0: 'no_restriction', 1: 'lax', 2: 'strict' }[Number(row.samesite)];
  if (!sameSite) return { unsupported: true };
  const cookie = {
    url: `${Number(row.is_secure) || Number(row.source_scheme) === 2 ? 'https' : 'http'}://${row.host_key.replace(/^\./, '')}${row.path}`,
    name: row.name,
    value: row.value,
    path: row.path,
    secure: !!Number(row.is_secure),
    httpOnly: !!Number(row.is_httponly),
    sameSite,
  };
  if (row.host_key.startsWith('.')) cookie.domain = row.host_key;
  if (Number(row.has_expires)) cookie.expirationDate = expirationDate;
  return { cookie };
}

async function importCookies(migration, cookies, now = Date.now() / 1000) {
  if (!migration || migration.status !== 'prepared') return migration ? { success: false } : null;
  const result = { imported: 0, expired: 0, unsupported: 0, failed: 0, success: false };
  const expected = [];
  try {
    for (const row of migration.rows) {
      const converted = toCookie(row, now);
      if (converted.expired) { result.expired++; continue; }
      if (converted.unsupported) { result.unsupported++; continue; }
      try {
        await cookies.set(converted.cookie);
        expected.push({ row, cookie: converted.cookie });
        result.imported++;
      } catch {
        result.failed++;
      }
    }
    await cookies.flushStore();
    const stored = await cookies.get({});
    for (const { row, cookie } of expected) {
      const found = stored.find(c => c.name === row.name && c.domain === row.host_key && c.path === row.path);
      if (!found || found.value !== cookie.value || found.secure !== cookie.secure ||
          found.httpOnly !== cookie.httpOnly || found.sameSite !== cookie.sameSite ||
          found.session !== !Number(row.has_expires) ||
          (cookie.expirationDate !== undefined &&
            (!Number.isFinite(found.expirationDate) || Math.abs(found.expirationDate - cookie.expirationDate) > 1))) {
        result.failed++;
      }
    }
    if (!result.failed && !result.unsupported) {
      fs.unlinkSync(migration.backupPath);
      result.success = true;
    }
  } catch {
    result.failed++;
  } finally {
    migration.rows = [];
  }
  return result;
}

module.exports = { prepareCookieMigration, importCookies, BACKUP_SUFFIX, COMPATIBILITY_BACKUP_SUFFIX };
