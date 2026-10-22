// @ts-check
// 対話プロンプトを、本物の @inquirer/prompts のまま標準入力を流し込んで実行する

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const promptModulePath = path.resolve(__dirname, '../scripts/prompt.js');

/**
 * @param {string} call prompt モジュールの関数呼び出し式
 * @param {string} stdin
 * @returns {unknown}
 */
function runPrompt(call, stdin) {
  const script = `
    const prompt = require(${JSON.stringify(promptModulePath)});
    prompt.${call}.then((result) => {
      process.stderr.write('\\nRESULT:' + JSON.stringify(result) + '\\n');
    });
  `;
  const result = spawnSync(process.execPath, ['-e', script], {
    input: stdin,
    encoding: 'utf-8',
    timeout: 30000,
  });
  assert.equal(result.status, 0, result.stderr);
  const match = /RESULT:(.*)/.exec(result.stderr);
  assert.ok(match, `result not found in output: ${result.stdout}${result.stderr}`);
  return JSON.parse(match[1]);
}

test('confirm は n で false を返す', () => {
  assert.equal(runPrompt("confirm('continue?', true)", 'n\n'), false);
});

test('confirm は y で true を返す', () => {
  assert.equal(runPrompt("confirm('continue?', false)", 'y\n'), true);
});

test('confirm は空入力でデフォルト値を返す', () => {
  assert.equal(runPrompt("confirm('continue?', false)", '\n'), false);
});

test('input は入力値を返す', () => {
  assert.equal(
    runPrompt("input('version?', '1.0.20190826-1')", '1.0.20190827-1\n'),
    '1.0.20190827-1',
  );
});

test('input は空入力でデフォルト値を返す', () => {
  assert.equal(runPrompt("input('version?', '1.0.20190826-1')", '\n'), '1.0.20190826-1');
});
