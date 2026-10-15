// @ts-check
// electron-builder が生成する latest.yml への releaseNotes 追記を、本物の js-yaml のまま実行する

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const yaml = require('js-yaml');

// electron-builder (nsis) が出力する latest.yml と同じ形
const LATEST_YML = `version: 1.1.20261015-1
files:
  - url: n-air-app-setup.1.1.20261015-1.exe
    sha512: 3Kq1DXf0kNvT0Ywq0B9ya/9XmCAsgmVlUzzZq8tbx2lbYt6rwMX4tqOd4hBXbGYa2sJ47X5UJgOK+qQ7fUkq4w==
    size: 312345678
path: n-air-app-setup.1.1.20261015-1.exe
sha512: 3Kq1DXf0kNvT0Ywq0B9ya/9XmCAsgmVlUzzZq8tbx2lbYt6rwMX4tqOd4hBXbGYa2sJ47X5UJgOK+qQ7fUkq4w==
releaseDate: '2026-10-15T01:23:45.678Z'
`;

/** @type {string} */
let tmpDir;

before(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nair-latest-yml-test-'));
});

after(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('releaseNotes を追記しても既存の項目は変わらない', () => {
  const { addReleaseNotesToLatestYml } = require('../scripts/latestYml');
  const filePath = path.join(tmpDir, 'latest.yml');
  fs.writeFileSync(filePath, LATEST_YML);
  const notes = [
    '追加: 新機能を追加 (#1234)',
    '修正: "引用符" や key: value を含む行 (#1235)',
    '- 先頭がハイフンの行',
    '',
    '# 先頭が # の行',
  ].join('\n');

  const result = addReleaseNotesToLatestYml(filePath, notes);

  assert.equal(result.path, 'n-air-app-setup.1.1.20261015-1.exe');
  const written = /** @type {Record<string, unknown>} */ (
    yaml.load(fs.readFileSync(filePath, 'utf-8'))
  );
  const original = /** @type {Record<string, unknown>} */ (yaml.load(LATEST_YML));
  assert.deepEqual(written, Object.assign({}, original, { releaseNotes: notes }));
  // electron-updater が比較に使う日時は文字列のまま保持されること
  assert.equal(written.releaseDate, '2026-10-15T01:23:45.678Z');
});
