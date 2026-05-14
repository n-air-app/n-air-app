// Jest runner wrapper that guarantees all spawned Electron child processes are
// killed on exit, even on Windows where POSIX process group kill is a no-op.
// @kayahr/jest-electron-runner uses process.kill(-pid) which silently fails on
// Windows, leaving renderer/GPU/utility processes as orphans.

const { spawn } = require('node:child_process');
const treeKill = require('tree-kill');

const jestBin = require.resolve('jest/bin/jest');
const child = spawn(
  process.execPath,
  [jestBin, '--silent', '--config', './jest.config.js', ...process.argv.slice(2)],
  { stdio: 'inherit', env: process.env },
);

let cleaning = false;
function cleanup(exitCode) {
  if (cleaning) return;
  cleaning = true;
  if (child.pid != null) {
    treeKill(child.pid, 'SIGKILL', () => process.exit(exitCode ?? 1));
  } else {
    process.exit(exitCode ?? 1);
  }
}

process.on('SIGINT', () => cleanup(130));
process.on('SIGTERM', () => cleanup(143));
process.on('SIGHUP', () => cleanup(129));
process.on('uncaughtException', (e) => { console.error(e); cleanup(1); });
child.on('exit', (code, signal) => cleanup(code ?? (signal ? 1 : 0)));
