// Run with Node 24: node scripts/test-cookie-compatibility.js <Electron-29.exe>
// Only synthetic cookies in a temporary profile are used. Both Electron versions
// must be installed; the repository's Electron is used for the v44 side.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

async function worker() {
  const { app, session } = require('electron');
  const [profile, resultPath, partition, operation, value, prepare] = process.argv.slice(3);
  app.setPath('userData', profile);
  const databasePath = path.join(profile, ...(partition ? ['Partitions', partition] : []), 'Network', 'Cookies');
  let migration;
  if (prepare !== 'skip' && Number(process.versions.electron.split('.')[0]) === 44) {
    migration = require('../main-process/cookie-migration').prepareCookieMigration(databasePath, operation === 'clear');
  }
  await app.whenReady();
  const { cookies } = partition ? session.fromPartition(`persist:${partition}`) : session.defaultSession;
  if (migration) await require('../main-process/cookie-migration').importCookies(migration, cookies);
  const url = 'https://example.com/';
  if (operation === 'set' || operation === 'clear') {
    await cookies.set({ url, name: 'synthetic', value, secure: true, httpOnly: true,
      sameSite: 'lax', expirationDate: Date.now() / 1000 + 86400 });
  } else if (operation === 'remove') {
    await cookies.remove(url, 'synthetic');
  }
  await cookies.flushStore();
  fs.writeFileSync(resultPath, JSON.stringify(await cookies.get({ url })));
  app.quit();
}

function verify() {
  const assert = require('node:assert/strict');
  const { spawnSync } = require('node:child_process');
  const { DatabaseSync } = require('node:sqlite');
  const oldElectron = process.argv[2];
  if (!oldElectron || !fs.existsSync(oldElectron)) throw new Error('Pass the path to Electron 29 executable');
  const currentElectron = require('electron');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nair-cookie-compatibility-'));
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  function run(executable, profile, partition, operation, value = '', prepare = '') {
    fs.mkdirSync(profile, { recursive: true });
    const resultPath = path.join(directory, 'result.json');
    fs.rmSync(resultPath, { force: true });
    const result = spawnSync(executable, [__filename, '--worker', profile, resultPath,
      partition, operation, value, prepare], { env, encoding: 'utf8', timeout: 30000, windowsHide: true });
    assert.equal(result.status, 0, result.stderr || String(result.error));
    const stored = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
    if (operation === 'remove' || value === '') {
      assert.deepEqual(stored, []);
    } else {
      assert.equal(stored.length, 1);
      assert.equal(stored[0].value, value);
      assert.equal(stored[0].secure, true);
      assert.equal(stored[0].httpOnly, true);
      assert.equal(stored[0].sameSite, 'lax');
      assert.equal(stored[0].session, false);
    }
  }
  try {
    for (const partition of ['', 'dev-hosts']) {
      for (const initial of ['fresh', 'electron29', 'electron44']) {
        const profile = path.join(directory, `${partition || 'default'}-${initial}`);
        if (initial === 'electron29') run(oldElectron, profile, partition, 'set', 'initial29');
        if (initial === 'electron44') run(currentElectron, profile, partition, 'set', 'initial44', 'skip');
        // Reading after a process restart must preserve preexisting cookies too.
        run(currentElectron, profile, partition, 'get', initial === 'fresh' ? '' : `initial${initial === 'electron29' ? '29' : '44'}`);
        run(currentElectron, profile, partition, 'set', 'written44');
        run(oldElectron, profile, partition, 'get', 'written44');
        run(oldElectron, profile, partition, 'set', 'updated29');
        run(currentElectron, profile, partition, 'get', 'updated29');
        run(currentElectron, profile, partition, 'set', 'updated44');
        run(oldElectron, profile, partition, 'get', 'updated44');
        run(oldElectron, profile, partition, 'remove');
        run(currentElectron, profile, partition, 'get');
        run(oldElectron, profile, partition, 'set', 'recreated29');
        run(currentElectron, profile, partition, 'remove');
        run(oldElectron, profile, partition, 'get');
        run(currentElectron, profile, partition, 'clear', 'afterClear44');
        run(oldElectron, profile, partition, 'set', 'afterClear29');
        run(currentElectron, profile, partition, 'get', 'afterClear29');
        const databasePath = path.join(profile, ...(partition ? ['Partitions', partition] : []), 'Network', 'Cookies');
        const db = new DatabaseSync(databasePath, { readOnly: true });
        assert.equal(Number(db.prepare("SELECT value FROM meta WHERE key = 'version'").get().value), 24);
        assert.equal(Number(db.prepare("SELECT value FROM meta WHERE key = 'last_compatible_version'").get().value), 21);
        db.close();
        console.log(`PASS: ${partition || 'default'} / ${initial}`);
      }
    }
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

if (process.argv[2] === '--worker') {
  worker().catch(error => {
    console.error(error);
    require('electron').app.exit(1);
  });
} else {
  verify();
}
