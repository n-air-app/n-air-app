import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const { prepareCookieMigration, importCookies, BACKUP_SUFFIX, COMPATIBILITY_BACKUP_SUFFIX } = require('./cookie-migration');
let directory: string;
let databasePath: string;

beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nair-cookie-migration-'));
  databasePath = path.join(directory, 'Cookies');
});

afterEach(() => fs.rmSync(directory, { recursive: true, force: true }));

function createDatabase(version = 21) {
  const db = new DatabaseSync(databasePath);
  db.exec(`CREATE TABLE meta (key TEXT PRIMARY KEY, value INTEGER);
    INSERT INTO meta VALUES ('version', ${version});
    CREATE TABLE cookies (host_key TEXT, name TEXT, value TEXT, encrypted_value BLOB,
      top_frame_site_key TEXT, path TEXT, expires_utc INTEGER, has_expires INTEGER,
      is_secure INTEGER, is_httponly INTEGER, source_scheme INTEGER, samesite INTEGER);`);
  return db;
}

function insertCookie(db: DatabaseSync, options: Record<string, unknown> = {}) {
  const row = {
    host: '.nicovideo.jp', name: 'user_session', value: 'synthetic-test-cookie',
    encrypted: Buffer.alloc(0), partition: '', path: '/',
    expires: 13300000000000000n, persistent: 1, secure: 1, httpOnly: 1, scheme: 2, sameSite: 1,
    ...options,
  };
  db.prepare('INSERT INTO cookies VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
    row.host as string, row.name as string, row.value as string, row.encrypted as Buffer,
    row.partition as string, row.path as string, row.expires as bigint,
    row.persistent as number, row.secure as number, row.httpOnly as number,
    row.scheme as number, row.sameSite as number,
  );
}

function cookieApi() {
  const stored: Array<Record<string, unknown>> = [];
  return {
    set: jest.fn(async (cookie: Record<string, unknown>) => {
      stored.push({ ...cookie, domain: cookie.domain ?? new URL(cookie.url as string).hostname,
        session: cookie.expirationDate === undefined });
    }),
    flushStore: jest.fn(async () => {}),
    get: jest.fn(async () => stored),
  };
}

test('未知の新しい形式には変更を加えない', () => {
  createDatabase(25).close();
  const before = fs.readFileSync(databasePath);
  expect(prepareCookieMigration(databasePath)).toBeNull();
  expect(fs.readFileSync(databasePath)).toEqual(before);
  expect(fs.existsSync(databasePath + BACKUP_SUFFIX)).toBe(false);
});

test('旧バックアップがある形式21のDBを消去・再移行しない', () => {
  const db = createDatabase();
  insertCookie(db);
  db.close();
  fs.writeFileSync(databasePath + BACKUP_SUFFIX, 'synthetic-backup');
  const before = fs.readFileSync(databasePath);
  expect(() => prepareCookieMigration(databasePath)).toThrow('Previous Cookie migration failed');
  expect(fs.readFileSync(databasePath)).toEqual(before);
  expect(fs.readFileSync(databasePath + BACKUP_SUFFIX, 'utf8')).toBe('synthetic-backup');
});

test('テーブルのないCookie DBは移行対象なしとして扱う', () => {
  new DatabaseSync(databasePath).close();
  expect(prepareCookieMigration(databasePath)).toBeNull();
  expect(fs.existsSync(databasePath + BACKUP_SUFFIX)).toBe(false);
});

test.each(['missing', 'empty'])('新規・空DBでも初回から29で保存可能な形式を作成する: %s', state => {
  if (state === 'empty') new DatabaseSync(databasePath).close();
  expect(prepareCookieMigration(databasePath)).toBeNull();
  const db = new DatabaseSync(databasePath);
  expect(Number(db.prepare("SELECT value FROM meta WHERE key = 'version'").get()!.value)).toBe(24);
  expect(Number(db.prepare("SELECT value FROM meta WHERE key = 'last_compatible_version'").get()!.value)).toBe(21);
  // The exact set of columns INSERTed by Electron 29 (the two v24 fields are omitted).
  db.exec(`INSERT INTO cookies (creation_utc, host_key, top_frame_site_key, name, value,
    encrypted_value, path, expires_utc, is_secure, is_httponly, last_access_utc,
    has_expires, is_persistent, priority, samesite, source_scheme, source_port, last_update_utc)
    VALUES (1, 'example.com', '', 'synthetic', 'value', x'', '/', 1, 1, 1, 1, 1, 1, 1, 1, 2, 443, 1)`);
  expect(db.prepare('SELECT source_type, has_cross_site_ancestor FROM cookies').get()).toEqual({
    source_type: 0, has_cross_site_ancestor: 1,
  });
  db.close();
  const before = fs.readFileSync(databasePath);
  expect(prepareCookieMigration(databasePath)).toBeNull();
  expect(fs.readFileSync(databasePath)).toEqual(before);
});

function makeStandardV24() {
  prepareCookieMigration(databasePath);
  const db = new DatabaseSync(databasePath);
  const schema = String(db.prepare("SELECT sql FROM sqlite_master WHERE name = 'cookies'").get()!.sql)
    .replace(/ DEFAULT [01]/g, '');
  db.exec(`DROP TABLE cookies; ${schema};
    CREATE UNIQUE INDEX cookies_unique_index ON cookies
      (host_key, top_frame_site_key, has_cross_site_ancestor, name, path, source_scheme, source_port);
    UPDATE meta SET value = '24' WHERE key = 'last_compatible_version';`);
  return db;
}

test('既に44で保存したDBを行・属性・64bit日時を保って互換化する', () => {
  const db = makeStandardV24();
  db.exec(`INSERT INTO cookies VALUES
    (13300000000000001, '.example.com', '', 'synthetic', 'value', x'', '/',
    13300000000000002, 1, 1, 13300000000000003, 1, 1, 1, 1, 2, 443, 13300000000000004, 2, 1)`);
  const statement = db.prepare('SELECT * FROM cookies');
  statement.setReadBigInts(true);
  const before = statement.all();
  db.close();
  expect(prepareCookieMigration(databasePath)).toBeNull();
  const updated = new DatabaseSync(databasePath);
  const after = updated.prepare('SELECT * FROM cookies');
  after.setReadBigInts(true);
  expect(after.all()).toEqual(before);
  updated.close();
  expect(fs.existsSync(databasePath + COMPATIBILITY_BACKUP_SUFFIX)).toBe(false);
});

test('互換化中の失敗はDB更新をロールバックしバックアップを残す', () => {
  const db = makeStandardV24();
  // An unexpected extra column must never be silently lost.
  db.exec('ALTER TABLE cookies ADD COLUMN future_column INTEGER');
  db.close();
  // Explicit schema validation is also required for an empty table.
  expect(() => prepareCookieMigration(databasePath)).toThrow();
  const after = new DatabaseSync(databasePath, { readOnly: true });
  expect(Number(after.prepare("SELECT value FROM meta WHERE key = 'last_compatible_version'").get()!.value)).toBe(24);
  expect(after.prepare('PRAGMA table_info(cookies)').all().some(c => c.name === 'future_column')).toBe(true);
  after.close();
  expect(fs.existsSync(databasePath + COMPATIBILITY_BACKUP_SUFFIX)).toBe(true);
});

test('旧試作のancestor=0を1に補正し44での更新・削除に備える', () => {
  const db = makeStandardV24();
  db.exec(`INSERT INTO cookies VALUES
    (1, 'example.com', '', 'synthetic', 'value', x'', '/', 1, 1, 1, 1, 1, 1, 1, 1, 2, 443, 1, 0, 0)`);
  db.close();
  prepareCookieMigration(databasePath);
  const after = new DatabaseSync(databasePath);
  expect(after.prepare('SELECT has_cross_site_ancestor FROM cookies').get()!.has_cross_site_ancestor).toBe(1);
  after.close();
});

test('--clearCookiesでは移行せず旧バックアップも削除する', () => {
  createDatabase().close();
  fs.writeFileSync(databasePath + BACKUP_SUFFIX, 'synthetic-backup');
  expect(prepareCookieMigration(databasePath, true)).toBeNull();
  expect(fs.existsSync(databasePath + BACKUP_SUFFIX)).toBe(false);
});

test('テーブルはあるがmetaがないDBは失敗として扱う', () => {
  const db = new DatabaseSync(databasePath);
  db.exec('CREATE TABLE cookies (name TEXT)');
  db.close();
  expect(() => prepareCookieMigration(databasePath)).toThrow('no such table: meta');
});

test('WALを含む旧DBをバックアップし64bitの日時を読み取る', () => {
  const db = createDatabase();
  db.exec('PRAGMA journal_mode=WAL');
  insertCookie(db);
  const migration = prepareCookieMigration(databasePath);
  expect(migration.rows).toHaveLength(1);
  expect(migration.rows[0].expires_utc).toBe(13300000000000000n);
  const backup = new DatabaseSync(migration.backupPath, { readOnly: true });
  expect(backup.prepare('SELECT count(*) AS count FROM cookies').get()!.count).toBe(1);
  backup.close();
  db.close();
});

test('登録・保存・属性確認に成功した場合だけバックアップを削除する', async () => {
  const db = createDatabase();
  insertCookie(db);
  insertCookie(db, { host: 'example.com', name: 'host-only', persistent: 0, secure: 0, httpOnly: 0, scheme: 1, sameSite: -1 });
  insertCookie(db, { name: 'expired', expires: 11644473600000000n });
  db.close();
  const migration = prepareCookieMigration(databasePath);
  const cookies = cookieApi();
  const result = await importCookies(migration, cookies, 1600000000);
  expect(result).toEqual({ imported: 2, expired: 1, unsupported: 0, failed: 0, success: true });
  expect(cookies.set.mock.calls[1][0]).toMatchObject({ url: 'http://example.com/', sameSite: 'unspecified' });
  expect(cookies.set.mock.calls[1][0].domain).toBeUndefined();
  expect(fs.existsSync(migration.backupPath)).toBe(false);
  expect(migration.rows).toEqual([]);
});

test.each(['encrypted', 'partition', 'set', 'flush', 'verify'])('未対応・失敗時はバックアップを残し再試行しない: %s', async failure => {
  const db = createDatabase();
  insertCookie(db, failure === 'encrypted' ? { encrypted: Buffer.from('synthetic') } :
    failure === 'partition' ? { partition: 'https://example.com' } : {});
  db.close();
  const migration = prepareCookieMigration(databasePath);
  const cookies = cookieApi();
  if (failure === 'set') cookies.set.mockRejectedValue(new Error('synthetic'));
  if (failure === 'flush') cookies.flushStore.mockRejectedValue(new Error('synthetic'));
  if (failure === 'verify') cookies.get.mockResolvedValue([]);
  expect((await importCookies(migration, cookies, 1600000000)).success).toBe(false);
  expect(fs.existsSync(migration.backupPath)).toBe(true);
  expect(prepareCookieMigration(databasePath).status).toBe('previous-failure');
  expect(migration.rows).toEqual([]);
});

test('壊れたDBは失敗として扱い元の内容を変更しない', () => {
  fs.writeFileSync(databasePath, 'synthetic-invalid-db');
  expect(() => prepareCookieMigration(databasePath)).toThrow();
  expect(fs.readFileSync(databasePath, 'utf8')).toBe('synthetic-invalid-db');
});
