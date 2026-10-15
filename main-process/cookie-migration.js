const fs = require('node:fs');

const BACKUP_SUFFIX = '.electron29-backup';

function prepareCookieMigration(databasePath) {
  const backupPath = databasePath + BACKUP_SUFFIX;
  if (fs.existsSync(backupPath)) return { status: 'previous-failure', backupPath };
  if (!fs.existsSync(databasePath)) return null;

  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(databasePath, { readOnly: true });
  try {
    const version = Number(db.prepare("SELECT value FROM meta WHERE key = 'version'").get()?.value);
    if (version !== 21) return null;
    // VACUUM includes committed WAL contents and creates a standalone, consistent backup.
    db.prepare('VACUUM INTO ?').run(backupPath);
    const statement = db.prepare('SELECT * FROM cookies');
    statement.setReadBigInts(true);
    return { status: 'prepared', backupPath, rows: statement.all() };
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

module.exports = { prepareCookieMigration, importCookies, BACKUP_SUFFIX };
