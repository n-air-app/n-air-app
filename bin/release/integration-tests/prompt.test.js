// @ts-check
// 対話プロンプトを、本物の @inquirer/prompts のまま標準入力を流し込んで実行する

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawn } = require('node:child_process');

const promptModulePath = path.resolve(__dirname, '../scripts/prompt.js');

/**
 * プロンプトが最初の描画を出力してから入力を渡す。
 * 描画前に届いた stdin は @inquirer/core に捨てられるため、起動直後に渡すと競合して不安定になる。
 * @param {string} call prompt モジュールの関数呼び出し式
 * @param {string} stdin
 * @returns {Promise<unknown>}
 */
function runPrompt(call, stdin) {
  const script = `
    const prompt = require(${JSON.stringify(promptModulePath)});
    prompt.${call}.then((result) => {
      process.stderr.write('\\nRESULT:' + JSON.stringify(result) + '\\n');
    });
  `;
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['-e', script]);
    let stdout = '';
    let stderr = '';
    let sent = false;

    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`timeout: ${stdout}${stderr}`));
    }, 30000);

    child.stdin.on('error', () => {});
    child.stdout.setEncoding('utf-8');
    child.stderr.setEncoding('utf-8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
      if (!sent) {
        sent = true;
        child.stdin.end(stdin);
      }
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      const match = /RESULT:(.*)/.exec(stderr);
      if (code !== 0 || !match) {
        reject(new Error(`exit code ${code}, result not found in output: ${stdout}${stderr}`));
        return;
      }
      resolve(JSON.parse(match[1]));
    });
  });
}

test('confirm は n で false を返す', async () => {
  assert.equal(await runPrompt("confirm('continue?', true)", 'n\n'), false);
});

test('confirm は y で true を返す', async () => {
  assert.equal(await runPrompt("confirm('continue?', false)", 'y\n'), true);
});

test('confirm は空入力でデフォルト値を返す', async () => {
  assert.equal(await runPrompt("confirm('continue?', false)", '\n'), false);
});

test('input は入力値を返す', async () => {
  assert.equal(
    await runPrompt("input('version?', '1.0.20190826-1')", '1.0.20190827-1\n'),
    '1.0.20190827-1',
  );
});

test('input は空入力でデフォルト値を返す', async () => {
  assert.equal(await runPrompt("input('version?', '1.0.20190826-1')", '\n'), '1.0.20190826-1');
});
