// @ts-check
// リリーススクリプトと設定ファイルが、依存パッケージを含めて読み込めることを確認する

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const releaseDir = path.resolve(__dirname, '..');

const dummyEnv = {
  NAIR_GITHUB_TOKEN: 'dummy',
  RELEASE_S3_BUCKET_NAME: 'dummy-bucket',
  INTERNAL_GITHUB_API_SERVER: 'https://ghe.example.com/api/v3',
  INTERNAL_GITHUB_ORGANIZATION: 'org',
  INTERNAL_GITHUB_REPOSITORY: 'repo',
  INTERNAL_GITHUB_REMOTE_NAME: 'internal',
  INTERNAL_GITHUB_TARGET_BRANCH: 'release',
  INTERNAL_SENTRY_ORGANIZATION: 'org',
  INTERNAL_SENTRY_PROJECT: 'project',
  NAIR_GITHUB_TOKEN_INTERNAL: 'dummy',
  RELEASE_DWANGO_S3_BUCKET_NAME: 'dummy-bucket',
};

/**
 * 読み込み時に cwd を変えるスクリプトもあるため子プロセスで実行する
 * @param {string} script
 */
function runNode(script) {
  const result = spawnSync(process.execPath, ['-e', script], {
    env: { ...process.env, ...dummyEnv },
    encoding: 'utf-8',
    timeout: 30000,
  });
  assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
  return result.stdout;
}

for (const script of ['mini-release.js', 'generatePatchNote.js']) {
  test(`${script} が読み込める`, () => {
    runNode(`require(${JSON.stringify(path.join(releaseDir, script))});`);
  });
}

for (const name of ['public-stable', 'public-unstable', 'internal-stable', 'internal-unstable']) {
  test(`configs/${name} が必要な項目を持つ`, () => {
    const stdout = runNode(
      `process.stdout.write(JSON.stringify(require(${JSON.stringify(
        path.join(releaseDir, 'configs', name),
      )})));`,
    );
    const config = JSON.parse(stdout);
    for (const key of ['host', 'organization', 'repository', 'remote', 'branch']) {
      assert.ok(config.target[key], `target.${key}`);
    }
    for (const key of ['organization', 'project']) {
      assert.ok(config.sentry[key], `sentry.${key}`);
    }
    for (const key of ['githubToken', 's3BucketName', 's3KeyPrefix']) {
      assert.ok(config.upload[key], `upload.${key}`);
    }
  });
}
