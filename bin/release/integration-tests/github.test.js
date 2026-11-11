// @ts-check
// GitHub API を使う処理を、本物の @octokit/rest のまま fetch を差し替えて実行する

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { Octokit } = require('@octokit/rest');

/**
 * @typedef {{ method: string, url: string, headers: Record<string, string>, body: any }} RecordedRequest
 */

/**
 * @param {(req: RecordedRequest) => { status: number, body: any }} handler
 */
function createOctokit(handler) {
  /** @type {RecordedRequest[]} */
  const requests = [];
  const octokit = new Octokit({
    auth: 'token test-token',
    request: {
      /**
       * @param {string} url
       * @param {RequestInit} init
       */
      fetch: async (url, init) => {
        const req = {
          method: init.method,
          url,
          headers: /** @type {Record<string, string>} */ (init.headers),
          body: init.body,
        };
        requests.push(req);
        const { status, body } = handler(req);
        return new Response(JSON.stringify(body), {
          status,
          headers: { 'content-type': 'application/json' },
        });
      },
    },
  });
  return { octokit, requests };
}

/** @type {string} */
let tmpDir;

before(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nair-github-test-'));
});

after(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('uploadToGithub はリリースアセットとしてファイルをアップロードする', async () => {
  const { uploadToGithub } = require('../scripts/uploadArtifacts');
  const content = Buffer.from('binary-content');
  const filePath = path.join(tmpDir, 'n-air-setup.exe.blockmap');
  fs.writeFileSync(filePath, content);

  const { octokit, requests } = createOctokit(() => ({ status: 201, body: { id: 1 } }));

  await uploadToGithub({
    octokit,
    owner: 'n-air-app',
    repo: 'n-air-app',
    release_id: 123,
    url: 'https://uploads.github.com/repos/n-air-app/n-air-app/releases/123/assets{?name,label}',
    pathname: filePath,
    contentType: 'application/octet-stream',
  });

  assert.equal(requests.length, 1);
  const [req] = requests;
  assert.equal(req.method, 'POST');
  const url = new URL(req.url);
  assert.equal(url.pathname, '/repos/n-air-app/n-air-app/releases/123/assets');
  assert.equal(url.searchParams.get('name'), 'n-air-setup.exe.blockmap');
  assert.equal(req.headers['content-type'], 'application/octet-stream');
  assert.ok(Buffer.from(req.body).equals(content), 'uploaded body should match');
});

test('uploadToGithub は API エラー時に例外を投げる', async () => {
  const { uploadToGithub } = require('../scripts/uploadArtifacts');
  const filePath = path.join(tmpDir, 'latest.yml');
  fs.writeFileSync(filePath, 'version: 1');

  const { octokit } = createOctokit(() => ({ status: 422, body: { message: 'Validation Failed' } }));

  await assert.rejects(
    uploadToGithub({
      octokit,
      owner: 'n-air-app',
      repo: 'n-air-app',
      release_id: 123,
      url: 'https://uploads.github.com/repos/n-air-app/n-air-app/releases/123/assets{?name,label}',
      pathname: filePath,
      contentType: 'application/json',
    }),
    /reached to a retry limit/,
  );
});

test('collectPullRequestMerges は git log の PR マージから PR タイトルを集める', async () => {
  const { collectPullRequestMerges } = require('../scripts/patchNote');

  // 前回リリースのタグと PR マージコミットを持つ一時リポジトリを作る
  const repoDir = fs.mkdtempSync(path.join(tmpDir, 'repo-'));
  /** @param {string[]} args */
  const git = (...args) => execFileSync('git', args, { cwd: repoDir, stdio: 'pipe' });
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 'test@example.com');
  git('config', 'user.name', 'test');
  git('config', 'commit.gpgsign', 'false');
  git('commit', '-q', '--allow-empty', '-m', 'initial');
  git('tag', 'v1.0.20190826-1');
  for (const pr of [11, 12]) {
    git('checkout', '-q', '-b', `feature-${pr}`);
    git('commit', '-q', '--allow-empty', '-m', `feature ${pr}`);
    git('checkout', '-q', 'main');
    git(
      'merge',
      '-q',
      '--no-ff',
      '-m',
      `Merge pull request #${pr} from n-air-app/feature-${pr}`,
      `feature-${pr}`,
    );
  }

  const titles = { 11: '修正: 何かを修正', 12: '追加: 何かを追加' };
  const { octokit, requests } = createOctokit((req) => {
    const number = Number(new URL(req.url).pathname.split('/').pop());
    return {
      status: 200,
      body: { number, title: titles[number], user: { login: `user${number}` } },
    };
  });

  const cwd = process.cwd();
  process.chdir(repoDir);
  try {
    const notes = await collectPullRequestMerges(
      { octokit, owner: 'n-air-app', repo: 'n-air-app' },
      '1.0.20190826-1',
      { addAuthor: true },
    );
    assert.equal(notes, '追加: 何かを追加 (#12) by user12\n修正: 何かを修正 (#11) by user11\n');
  } finally {
    process.chdir(cwd);
  }

  assert.deepEqual(
    requests.map((r) => [r.method, new URL(r.url).pathname]).sort(),
    [
      ['GET', '/repos/n-air-app/n-air-app/pulls/11'],
      ['GET', '/repos/n-air-app/n-air-app/pulls/12'],
    ],
  );
});
