const fs = require('fs');
const os = require('os');
const path = require('path');

const { createCachedSigner, shouldCache, computeCacheKey } = require('./sign-with-cache');

const ARGS = ['sign', '/tr', 'http://timestamp.example', '/sha1', 'THUMBPRINT', '/fd', 'sha256'];

let workDir;
let cacheDir;
let signCount;
let log;

/** signtool の代わりに、ファイル末尾に署名の印を付ける */
async function fakeSignFile(task) {
  signCount++;
  fs.appendFileSync(task.path, `|signed#${signCount}`);
}

function makeTask(name, content, args = ARGS) {
  const filePath = path.join(workDir, name);
  fs.writeFileSync(filePath, content);
  return { path: filePath, computeSignToolArgs: () => [...args, filePath] };
}

function makeSigner(overrides = {}) {
  return createCachedSigner({
    cacheDir,
    signFile: fakeSignFile,
    isCacheable: () => true,
    log,
    ...overrides,
  });
}

beforeEach(() => {
  workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sign-cache-work-'));
  cacheDir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'sign-cache-')), 'cache');
  signCount = 0;
  log = { info: jest.fn(), warn: jest.fn() };
});

afterEach(() => {
  fs.rmSync(workDir, { recursive: true, force: true });
  fs.rmSync(path.dirname(cacheDir), { recursive: true, force: true });
});

test('2回目は signtool を呼ばずにキャッシュの署名済みファイルをコピーする', async () => {
  const signer = makeSigner();

  const first = makeTask('a.exe', 'original');
  await signer(first);
  expect(signCount).toBe(1);
  expect(fs.readFileSync(first.path, 'utf8')).toBe('original|signed#1');

  const second = makeTask('a.exe', 'original');
  await signer(second);
  expect(signCount).toBe(1);
  expect(fs.readFileSync(second.path, 'utf8')).toBe('original|signed#1');
});

test('中身が違えば署名し直す', async () => {
  const signer = makeSigner();
  await signer(makeTask('a.exe', 'v1'));
  const task = makeTask('a.exe', 'v2');
  await signer(task);
  expect(signCount).toBe(2);
  expect(fs.readFileSync(task.path, 'utf8')).toBe('v2|signed#2');
});

test('signtool の引数（証明書など）が違えば署名し直す', async () => {
  const signer = makeSigner();
  await signer(makeTask('a.exe', 'same'));
  await signer(makeTask('a.exe', 'same', [...ARGS.slice(0, 4), 'OTHER_THUMBPRINT', ...ARGS.slice(5)]));
  expect(signCount).toBe(2);
});

test('入力ファイルのパスが違っても、中身と引数が同じならキャッシュを使う', async () => {
  const signer = makeSigner();
  await signer(makeTask('a.exe', 'same'));
  const task = makeTask('b.exe', 'same');
  await signer(task);
  expect(signCount).toBe(1);
  expect(fs.readFileSync(task.path, 'utf8')).toBe('same|signed#1');
});

test('キャッシュ対象外のファイルは毎回署名し、キャッシュに保存しない', async () => {
  const signer = makeSigner({ isCacheable: () => false });
  await signer(makeTask('N Air.exe', 'main'));
  await signer(makeTask('N Air.exe', 'main'));
  expect(signCount).toBe(2);
  expect(fs.existsSync(cacheDir)).toBe(false);
});

test('キャッシュのファイルが壊れていたら署名し直す', async () => {
  const signer = makeSigner();
  const first = makeTask('a.exe', 'original');
  await signer(first);

  const key = computeCacheKey(
    require('crypto').createHash('sha256').update('original').digest('hex'),
    first.computeSignToolArgs(true),
  );
  fs.writeFileSync(path.join(cacheDir, `${key}.exe`), 'broken');

  const second = makeTask('a.exe', 'original');
  await signer(second);
  expect(signCount).toBe(2);
  expect(fs.readFileSync(second.path, 'utf8')).toBe('original|signed#2');
  expect(log.warn).toHaveBeenCalled();
});

test('署名に失敗したらエラーをそのまま投げ、キャッシュに保存しない', async () => {
  const signer = makeSigner({
    signFile: async () => {
      throw new Error('signtool failed');
    },
  });
  await expect(signer(makeTask('a.exe', 'x'))).rejects.toThrow('signtool failed');
  expect(fs.existsSync(cacheDir)).toBe(false);
});

describe('shouldCache', () => {
  const appInfo = { productFilename: 'N Air', version: '1.1.20261118-1' };

  test.each([
    ['N Air.exe', false],
    ['n air.exe', false],
    ['n-air-app-setup.1.1.20261118-1.exe', false],
    ['n-air-app-setup.1.1.20261118-1.__uninstaller.exe', false],
    ['obs64.exe', true],
    ['elevate.exe', true],
    ['crash-handler-process.exe', true],
  ])('%s → %s', (name, expected) => {
    expect(shouldCache(path.join('dist', 'win-unpacked', name), appInfo)).toBe(expected);
  });
});
