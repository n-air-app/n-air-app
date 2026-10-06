import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const { prepareCookieMigration, importCookies, BACKUP_SUFFIX } = require('./cookie-migration');
let directory: string;
let databasePath: string;

beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nair-cookie-migration-'));
  databasePath = path.join(directory, 'Cookies');
});

afterEach(() => fs.rmSync(directory, { recursive: true, force: true }));

function createDatabase(version = 21) {
  const db = new DatabaseSync(databasePath);
  db.exec(`CREATE TABLE meta (key TEXT, value INTEGER);
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

test('新しいDBや存在しないDBには変更を加えない', () => {
  expect(prepareCookieMigration(databasePath)).toBeNull();
  createDatabase(24).close();
  expect(prepareCookieMigration(databasePath)).toBeNull();
  expect(fs.existsSync(databasePath + BACKUP_SUFFIX)).toBe(false);
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
