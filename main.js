////////////////////////////////////////////////////////////////////////////////
// Set Up Environment Variables
////////////////////////////////////////////////////////////////////////////////
const pjson = require('./package.json');

if (pjson.env === 'production') {
  process.env.NODE_ENV = 'production';
}
if (pjson.name === 'n-air-app-unstable' || pjson.name === 'n-air-app-upstream') {
  process.env.NAIR_UNSTABLE = true;
}
if (process.env.NODE_ENV !== 'production' && process.env.NAIR_UNSTABLE) {
  if (pjson.name !== 'n-air-app-upstream') {
    // DEBUG
    pjson.name = 'n-air-app-unstable';
  }
}
if (pjson.name === 'n-air-app-preview') {
  process.env.NAIR_PREVIEW = true;
}
if (pjson.name === 'n-air-app-ipc') {
  process.env.NAIR_IPC = true;
}
process.env.NAIR_VERSION = pjson.version;
process.env.NAIR_PRODUCT_NAME = pjson.buildProductName;

console.log(`pjson.name = ${pjson.name}`); // DEBUG

function getObsStudioNodeVersion() {
  const osnVersionMatch = pjson.dependencies['obs-studio-node'].match(/\bosn-(\d+\.\d+\.\d+)/);
  if (osnVersionMatch && osnVersionMatch.length > 1) {
    return osnVersionMatch[1];
  }
  return null;
}
const osnVersion = getObsStudioNodeVersion();

////////////////////////////////////////////////////////////////////////////////
// Modules and other Requires
////////////////////////////////////////////////////////////////////////////////
const electron = require('electron');

const { app, BrowserWindow, ipcMain, session, dialog, webContents, shell, crashReporter, net } =
  electron;
const path = require('node:path');
const fs = require('node:fs');
const remote = require('@electron/remote/main');
const { fetchViaElectronNet } = require('./main-process/fetch');
const { recoverOrphanedNairObsProcess } = require('./main-process/obs-orphan-recovery');

////////////////////////////////////////////////////////////////////////////////
// Dev Hosts Configuration
////////////////////////////////////////////////////////////////////////////////

/**
 * Load dev-hosts config from bundled dev-hosts.json (packaged builds)
 * or from path specified in .dev-hosts-path (development).
 * NAIR_DEV_HOSTS=N selects the N-th (1-indexed) path in .dev-hosts-path.
 * Returns null if not configured or loading fails.
 */
function loadDevHostsConfig() {
  // webpack compile時にdev-hosts.jsonが書き出される（NAIR_DEV_HOSTS=N pnpm compile）。
  // pnpm startでenv varなしでも自動的にdev環境として動作する。
  // パッケージビルドでもelectron-builderがdev-hosts.jsonをバンドルするため同様に動作する。
  try {
    const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'dev-hosts.json'), 'utf-8'));
    console.log('[dev-hosts] Loaded config from dev-hosts.json');
    return config;
  } catch (e) {
    if (e.code !== 'ENOENT') console.warn('[dev-hosts] Failed to parse dev-hosts.json:', e.message);
  }
  // フォールバック: NAIR_DEV_HOSTS env varで .dev-hosts-path から直接読む（compileせずにstartする場合）
  const n = parseInt(process.env.NAIR_DEV_HOSTS, 10);
  if (!n || n <= 0) return null;
  try {
    const devHostsPathFile = path.join(__dirname, '.dev-hosts-path');
    const lines = fs
      .readFileSync(devHostsPathFile, 'utf-8')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'));
    const relPath = lines[n - 1];
    if (!relPath) throw new Error(`.dev-hosts-path has no entry at line ${n}`);
    const fullPath = path.resolve(__dirname, relPath);
    const config = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
    console.log(`[dev-hosts] Loaded config from: ${fullPath}`);
    return config;
  } catch (e) {
    console.warn('[dev-hosts] Failed to load config:', e.message);
    return null;
  }
}

global.devHostsConfig = loadDevHostsConfig();

/** Electron session partition name for dev-hosts builds. undefined = use defaultSession. */
const devHostsPartition = global.devHostsConfig ? 'persist:dev-hosts' : undefined;

/**
 * Returns the Electron session to use for cookies and webRequest.
 * dev-hosts builds use a separate persistent partition to keep dev and production cookies independent.
 */
function getAppSession() {
  if (devHostsPartition) {
    return electron.session.fromPartition(devHostsPartition);
  }
  return electron.session.defaultSession;
}

/**
 * Apply dev-hosts URL transformation (mirrors app/services/dev-hosts.ts).
 * overrides take priority over domainMap.
 */
function devHostsTransformUrl(url) {
  const cfg = global.devHostsConfig;
  if (!cfg) return url;
  if (cfg.overrides) {
    const prefixes = Object.keys(cfg.overrides).sort((a, b) => b.length - a.length);
    for (const prefix of prefixes) {
      if (url.startsWith(prefix)) return cfg.overrides[prefix] + url.slice(prefix.length);
    }
  }
  if (cfg.domainMap) {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname;
      for (const [prodDomain, devDomain] of Object.entries(cfg.domainMap)) {
        if (hostname === prodDomain || hostname.endsWith('.' + prodDomain)) {
          urlObj.hostname = hostname.slice(0, -prodDomain.length) + devDomain;
          return urlObj.toString();
        }
      }
    } catch { }
  }
  return url;
}

function removePathWithRetry(rmPath) {
  const MAX_RETRIES = 3;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      fs.rmSync(rmPath, { recursive: true, force: true });
      return; // 成功したら即座に終了
    } catch (e) {
      console.error(`failed to delete '${rmPath}' (attempt ${attempt}/${MAX_RETRIES}): `, e);
      if (attempt === MAX_RETRIES) {
        // Sentry未初期化のため送信できない
        dialog.showErrorBox('ファイルの削除に失敗しました', `Failed to delete '${rmPath}'.\n${e}`);
      } else {
        // ファイルロック解放を待つ
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000);
      }
    }
  }
}

function clearCacheDirSelectively(userDataPath, preserveDirs) {
  const preserveSet = new Set(preserveDirs.map((d) => d.toLowerCase()));
  let entries;
  try {
    entries = fs.readdirSync(userDataPath, { withFileTypes: true });
  } catch (e) {
    console.error(`failed to read directory '${userDataPath}': `, e);
    return;
  }
  for (const entry of entries) {
    if (preserveSet.has(entry.name.toLowerCase())) {
      console.log(`preserving: ${entry.name}`);
      continue;
    }
    removePathWithRetry(path.join(userDataPath, entry.name));
  }
}

// We use a special cache directory for running tests
if (process.env.NAIR_CACHE_DIR) {
  app.setPath('appData', process.env.NAIR_CACHE_DIR);
  app.setPath('userData', path.join(app.getPath('appData'), 'nair-client'));
} else {
  app.setPath('userData', path.join(app.getPath('appData'), pjson.name));
}

if (process.argv.includes('--clearCacheDir')) {
  const rmPath = app.getPath('userData');
  if (process.argv.includes('--includeSceneCollections')) {
    console.log('clear cache directory (including scene collections)!: ', rmPath);
    removePathWithRetry(rmPath);
  } else {
    console.log('clear cache directory (preserving scene collections)!: ', rmPath);
    clearCacheDirSelectively(rmPath, ['SceneCollections', 'SceneConfigs']);
  }
}

function getCookieFiles() {
  const basePath = devHostsPartition
    ? path.join(app.getPath('userData'), 'Partitions', 'dev-hosts', 'Network')
    : path.join(app.getPath('userData'), 'Network');
  return [path.join(basePath, 'Cookies'), path.join(basePath, 'Cookies-journal')];
}

async function clearCookies() {
  // 読み込めている場合はファイルを消してもメモリから書き戻してしまうため、メモリ上のクッキーを先に削除する
  const session = getAppSession();
  await session.clearStorageData({ storages: ['cookies'] });
  session.flushStorageData();

  // 読み込めていない場合は上記でも消えないので、実ファイルを削除する
  const files = getCookieFiles();
  console.log('clear cookies: ', files);
  for (const file of files) {
    try {
      removePathWithRetry(file);
    } catch (e) {
      console.error('failed to delete cookie file', file, e);
    }
  }
}

// 必要なDLLが足りないため、Visual C++ 再頒布可能パッケージを案内するダイアログを表示する

async function showRequiredSystemComponentInstallGuideDialog() {
  const result = await dialog.showMessageBox({
    type: 'error',
    title: `${pjson.buildProductName} の実行に必要なシステムコンポーネントが不足しています`,
    message:
      'Microsoftのウェブサイトから Visual C++ 再頒布可能パッケージ(x64)をインストールしてから再度起動してください。',
    buttons: ['ブラウザでダウンロードする', 'ダウンロードページを開く', '何もせず終了'],
    defaultId: 1,
    cancelId: 2,
    noLink: true,
  });
  switch (result.response) {
    case 0:
      await shell.openExternal('https://aka.ms/vc14/vc_redist.x64.exe');
      break;
    case 1:
      await shell.openExternal(
        'https://learn.microsoft.com/ja-jp/cpp/windows/latest-supported-vc-redist?view=msvc-170#latest-supported-redistributable-version',
      );
      break;
    case 2:
      break;
  }
  // 呼び出し元が exit を担う（crash-handler 起動前の呼び出しは app.exit() 直呼び、
  // 起動後の呼び出しは exitWithCrashHandlerCleanup() 経由）
}

async function recollectUserSessionCookie() {
  // electron14->15 で SameSite 未指定 (unspecified) の cookie がフィルタされる問題へのパッチ。
  // API 呼び出しは session.cookies から読み取った値を X-Niconico-Session / Cookie ヘッダで
  // 明示送信するため、クロスサイト自動付与用の SameSite=None は不要。
  // SameSite=None; Secure; not Partitioned は Chromium の third-party cookie 警告の対象になるため Lax にする。
  console.log('recollectUserSessionCookie');
  try {
    const cookies = await getAppSession().cookies.get({
      domain: global.devHostsConfig?.cookieDomain ?? '.nicovideo.jp',
      name: 'user_session', // 他のキーまでやるとNAIR_UNSTABLE=0で問題があるかもなので一旦必須だけ、状況に応じてで
    });
    if (!cookies || !cookies.length) return;

    for (const cookie of cookies) {
      // 既に目的の属性なら何もしない（過去に no_restriction にした cookie は Lax へ移行する）
      if (cookie.sameSite === 'lax' && cookie.httpOnly && cookie.secure) {
        console.log(`no-need change cookie ${cookie.name}`);
        continue;
      }

      let d = cookie.domain;
      if (d[0] === '.') d = d.substring(1);

      cookie.url = `https://${d}`; //nicovideo.jp';
      cookie.sameSite = 'lax';
      cookie.httpOnly = true;
      cookie.secure = true;

      await getAppSession().cookies.set(cookie);
      // value（セッショントークン）はログに出さない
      console.log(
        `cookie changed name=${cookie.name} domain=${cookie.domain} sameSite=${cookie.sameSite} httpOnly=${cookie.httpOnly} secure=${cookie.secure}`,
      );
    }
  } catch (e) {
    console.log(`cookie error ${e.toString()}`);
  }
}

class WindowCleanupWaiter {
  /** @type {Map<number, { resolve: () => void, promise: Promise<void> }>}
   */
  _waitCleanupWindows = new Map();

  /**
   *
   * @param {number} windowId
   * @param {boolean} enable
   */
  async set(windowId, enable) {
    if (!enable) {
      if (this._waitCleanupWindows.has(windowId)) {
        const { resolve } = this._waitCleanupWindows.get(windowId);
        resolve();
        this._waitCleanupWindows.delete(windowId);
      }
    } else {
      if (!this._waitCleanupWindows.has(windowId)) {
        let resolve;
        const promise = new Promise((resolve_) => {
          resolve = resolve_;
        });
        this._waitCleanupWindows.set(windowId, { resolve, promise });
      }
    }
  }

  /**
   *
   * @param {number} windowId
   * @returns
   */
  async wait(windowId) {
    if (this._waitCleanupWindows.has(windowId)) {
      // ウィンドウのクリーンアップを待つが、タイムアウトでも打ち切る
      const CLEANUP_TIMEOUT = 3000;
      await Promise.race([
        this._waitCleanupWindows.get(windowId).promise,
        new Promise((resolve) => {
          setTimeout(resolve, CLEANUP_TIMEOUT);
        }),
      ]);
      return;
    }
  }
}

// This ensures that only one copy of our app can run at once.
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
}

try {
  const crashHandler = require('crash-handler');
  initialize(crashHandler);
} catch (e) {
  console.error('require crash-handler failed: ', e);
  app.on('ready', async () => {
    await showRequiredSystemComponentInstallGuideDialog();
    app.exit(0);
  });
}

remote.initialize();

function initialize(crashHandler) {
  const { Updater } = require('./updater/Updater.js');
  const { randomUUID } = require('node:crypto');
  const windowStateKeeper = require('electron-window-state');
  const { URL } = require('node:url');

  const pid = require('node:process').pid;

  app.commandLine.appendSwitch('force-ui-direction', 'ltr');
  process.env.IPC_UUID = `nair-${randomUUID()}`;

  /* Determine the current release channel we're
   * on based on name. The channel will always be
   * the premajor identifier, if it exists.
   * Otherwise, default to latest. */
  /*
  const releaseChannel = (() => {
    const components = semver.prerelease(pjson.version);

    if (components) return components[0];
    return 'latest';
  })();
  */

  ////////////////////////////////////////////////////////////////////////////////
  // Main Program
  ////////////////////////////////////////////////////////////////////////////////

  // 起動速度改善: 重い同期処理は app.on('ready') 後に実行
  // workaround for  https://github.com/electron/electron/issues/19468, https://github.com/electron/electron/issues/19978
  // (Electron 6 to 8 does not launch in Win10 dark mode with DevTool extensions installed)
  // removePathWithRetry(path.join(app.getPath('userData'), 'DevTools Extensions'));

  const util = require('node:util');
  const logFile = path.join(app.getPath('userData'), 'app.log');
  const maxLogBytes = 131072;

  ipcMain.on('logmsg', (e, msg) => {
    logFromRemote(msg.level, msg.sender, msg.message);
  });

  function logFromRemote(level, sender, msg) {
    msg.split('\n').forEach((line) => {
      writeLogLine(`[${new Date().toISOString()}] [${level}] [${sender}] - ${line}`);
    });
  }

  ipcMain.on('get-latest-obs-log', (e) => {
    const logDir = path.join(app.getPath('userData'), 'node-obs', 'logs');

    // get the latest log file pattern: 'yyyy-mm-dd hh-mm-ss.txt'; sort by name
    const files = fs.readdirSync(logDir);
    if (files.length === 0) {
      e.returnValue = {
        filename: 'no log file found',
        data: null,
      };
      return;
    }

    files.sort();
    const latestFilename = files.pop();
    const latestPathname = path.join(logDir, latestFilename);

    // get file body and return
    const data = fs.readFileSync(latestPathname, 'utf8');
    console.log('Read OBS log file:', latestPathname, data.length, 'bytes');
    e.returnValue = {
      filename: latestFilename,
      data,
    };
  });

  function getFileListRecursive(dir, prefix = '') {
    const files = fs.readdirSync(path.join(dir, prefix));
    return files.flatMap((file) => {
      const pathname = path.join(dir, prefix, file);
      const stat = fs.statSync(pathname);
      if (stat.isDirectory()) {
        return getFileListRecursive(dir, path.join(prefix, file));
      } else {
        return [path.join(prefix, file)];
      }
    });
  }

  ipcMain.on('get-obs-plugin-files-list', (e) => {
    const pluginDir = path.join(
      app.getAppPath().replace('app.asar', 'app.asar.unpacked'),
      'node_modules',
      'obs-studio-node',
      'obs-plugins',
      '64bit',
    );
    console.log('get-obs-plugin-files-list:', pluginDir);

    const files = getFileListRecursive(pluginDir);
    e.returnValue = { path: pluginDir, files };
  });

  const consoleLog = console.log;
  console.log = (...args) => {
    if (!process.env.NAIR_DISABLE_MAIN_LOGGING) {
      const serialized = args
        .map((arg) => {
          if (typeof arg === 'string') return arg;

          return util.inspect(arg);
        })
        .join(' ');

      logFromRemote('info', 'electron-main', serialized);
    }
  };

  const lineBuffer = [];

  function writeLogLine(line) {
    // Also print to stdout
    consoleLog(line);

    lineBuffer.push(`${line}\n`);
    flushNextLine();
  }

  // Synchronously flush all pending log lines

  function flushLogBufferSync() {
    if (lineBuffer.length === 0) return;
    try {
      const allLines = lineBuffer.join('');
      fs.appendFileSync(logFile, allLines);
      lineBuffer.length = 0; // Clear buffer
    } catch (e) {
      consoleLog('Error flushing log buffer:', e);
    }
  }

  let writeInProgress = false;

  function flushNextLine() {
    if (lineBuffer.length === 0) return;
    if (writeInProgress) return;

    const nextLine = lineBuffer.shift();

    writeInProgress = true;

    fs.writeFile(logFile, nextLine, { flag: 'a' }, (e) => {
      writeInProgress = false;

      if (e) {
        consoleLog('Error writing to log file', e);
        return;
      }

      flushNextLine();
    });
  }

  const os = require('node:os');
  const cpus = os.cpus();

  ipcMain.on('get-cpu-model', (e) => {
    e.returnValue = cpus[0].model;
  });

  // Source: https://stackoverflow.com/questions/10420352/converting-file-size-in-bytes-to-human-readable-string/10420404

  function humanFileSize(bytes, si) {
    const thresh = si ? 1000 : 1024;
    if (Math.abs(bytes) < thresh) {
      return bytes + ' B';
    }
    const units = si
      ? ['kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
      : ['KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];
    let u = -1;
    do {
      bytes /= thresh;
      ++u;
    } while (Math.abs(bytes) >= thresh && u < units.length - 1);
    return bytes.toFixed(1) + ' ' + units[u];
  }

  console.log('=================================');
  console.log('N Air');
  console.log(`Version: ${process.env.NAIR_VERSION}`);
  console.log(`obs-studio-node version: ${osnVersion}`);
  console.log(`OS: ${os.platform()} ${os.release()}`);
  console.log(`Arch: ${process.arch}`);
  console.log(`CPU: ${cpus[0].model}`);
  console.log(`Cores: ${cpus.length}`);
  console.log(`Memory: ${humanFileSize(os.totalmem(), false)}`);
  console.log(`Free: ${humanFileSize(os.freemem(), false)}`);
  console.log(`UserData path: ${app.getPath('userData')}`);
  console.log('=================================');

  app.on('ready', () => {
    // network logging is disabled by default
    if (!process.argv.includes('--network-logging')) return;

    // ignore fs requests
    const filter = { urls: ['https://*', 'http://*'] };

    getAppSession().webRequest.onBeforeRequest(filter, (details, callback) => {
      console.log('HTTP REQUEST', details.method, details.url);
      callback(details);
    });

    getAppSession().webRequest.onErrorOccurred(filter, (details) => {
      console.log('HTTP REQUEST FAILED', details.method, details.url);
    });

    getAppSession().webRequest.onCompleted(filter, (details) => {
      console.log('HTTP REQUEST COMPLETED', details.method, details.url, details.statusCode);
    });
  });

  // Windows
  /** @type import('electron').BrowserWindow */
  let mainWindow;
  /** @type import('electron').BrowserWindow */
  let childWindow;

  // Somewhat annoyingly, this is needed so that the child window
  // can differentiate between a user closing it vs the app
  // closing the windows before exit.
  let allowMainWindowClose = false;
  let shutdownStarted = false;
  let appShutdownTimeout;

  global.indexUrl = process.env.DEV_SERVER || `file://${__dirname}/index.html`;

  if (process.env.DEV_SERVER) {
    // During dev server hot reload, Electron's WebFrameMain.prototype.send() catches
    // "Render frame was disposed" internally and calls console.error() without re-throwing.
    // try-catch cannot suppress this, so we filter the console output directly.
    const originalConsoleError = console.error;
    console.error = function (...args) {
      if (typeof args[0] === 'string' && args[0].startsWith('Error sending from webFrameMain')) {
        return;
      }
      return originalConsoleError.apply(this, args);
    };
  }

  function openDevTools() {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.openDevTools({ mode: 'undocked' });
    }
    if (childWindow && !childWindow.isDestroyed()) {
      childWindow.webContents.openDevTools({ mode: 'undocked' });
    }
  }

  const SentryElectron = require('@sentry/electron/main');

  // crash-handler-process.exe を終了させてから app.exit() する。
  // 直接 app.exit() を呼ぶと crash-handler.log がロックされたまま残り、
  // 次の --clearCacheDir 再起動で EBUSY になる。
  function exitWithCrashHandlerCleanup(exitCode = 0) {
    const enableCrashHandler = !process.env.DEV_SERVER || process.env.NAIR_DEBUG_CRASH_HANDLER;
    if (enableCrashHandler && crashHandler) {
      try {
        crashHandler.terminateCrashHandler(pid);
      } catch (e) {
        console.error('[EXIT] Failed to terminate crash handler:', e);
      }
      // terminateCrashHandler は tryConnect (非同期 connect→write) を使うため、
      // setTimeout でイベントループに逃がし送信完了の猶予を与える。
      setTimeout(() => app.exit(exitCode), 500);
    } else {
      app.exit(exitCode);
    }
  }

  function handleFinishedReport() {
    // 先にsentryへの送信flushを開始する
    const flush = SentryElectron.flush(3000).catch((error) => {
      console.error(error);
    });

    dialog.showErrorBox(
      '予期せぬエラー',
      '予期しないエラーが発生したため、アプリケーションをシャットダウンします。ご不便をおかけして申し訳ありません。\n' +
      'この件に関する情報はデバッグ目的で送信されました。不具合を解決するためにご協力いただきありがとうございます。',
    );

    // ダイアログが閉じたら終了
    flush.finally(() => {
      exitWithCrashHandlerCleanup();
    });
  }

  const sentryDefs = require('./bundles/sentry-defs');

  if (pjson.env === 'production' || process.env.NAIR_REPORT_TO_SENTRY) {
    process.on('uncaughtException', (error) => {
      console.log('uncaughtException', error);
      handleFinishedReport();
    });

    console.log(`Sentry DSN: ${sentryDefs.DSN}`);
    SentryElectron.init({
      dsn: sentryDefs.DSN,
      release: process.env.NAIR_VERSION,
      // sentry-trace/baggage ヘッダーの自動付与を無効化。
      // 無指定だと electronNetIntegration が net.request 経由の全リクエストに
      // ヘッダーを付与し、ニコニコ生放送APIのCORSプリフライトが
      // sentry-trace ヘッダーで拒否される(Access-Control-Allow-Headersに含まれないため)。
      tracePropagationTargets: [],
    });
    if (osnVersion) {
      SentryElectron.getCurrentScope().setTag('obs-studio-node', osnVersion);
    }

    crashReporter.start({
      productName: 'n-air-app',
      companyName: 'n-air-app',
      submitURL: sentryDefs.MINIDUMP_URL,
      extra: {
        version: process.env.NAIR_VERSION,
        processType: 'main',
      },
    });

    ipcMain.on('crash-context-update', (_event, key, value) => {
      crashReporter.addExtraParameter(key, value);
    });
  } else {
    console.log('Sentry disabled, SENTRY_DSN = ', sentryDefs.DSN);
  }

  // Import splash window functions
  const { createSplashWindow, closeSplashWindow } = require('./splash/splash-window');

  // Safely send IPC messages to a BrowserWindow or WebContents.
  // During dev hot reload, the render frame may be disposed while the window is still alive.
  // BrowserWindow.isDestroyed() does not catch this — only the frame is replaced, not the window.

  function safeSend(target, channel, ...args) {
    try {
      if (target.isDestroyed()) return false;
      const wc = target.webContents || target;
      wc.send(channel, ...args);
      return true;
    } catch (e) {
      if (e.message && e.message.includes('Render frame was disposed')) {
        return false;
      }
      throw e;
    }
  }

  async function startApp() {
    if (process.argv.includes('--clearCookies')) {
      SentryElectron.captureEvent({
        message: 'clearCookies',
        level: 'info',
        extra: {
          args: process.argv,
        },
        fingerprint: ['clearCookies'],
      });

      // クッキーを消す
      // async 関数は startApp() からなら呼べるのでここで実行する
      await clearCookies();
    } else {
      await recollectUserSessionCookie();
    }
    const isDevMode = process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test';
    let crashHandlerLogPath = '';
    if (process.env.NODE_ENV !== 'production' || !!process.env.SLOBS_PREVIEW) {
      crashHandlerLogPath = app.getPath('userData');
    }

    if (!process.env.DEV_SERVER) {
      crashHandler.startCrashHandler(
        app.getAppPath(),
        process.env.NAIR_VERSION,
        isDevMode.toString(),
        crashHandlerLogPath,
        process.IPC_UUID,
      );
      crashHandler.registerProcess(pid, false);

      ipcMain.on('register-in-crash-handler', (event, arg) => {
        crashHandler.registerProcess(arg.pid, arg.critical);
      });

      ipcMain.on('unregister-in-crash-handler', (event, arg) => {
        crashHandler.unregisterProcess(arg.pid);
      });
    }

    const { resolveWindowBounds } = require('./main-process/window-startup-state');

    // electron-window-state の validateState() → resetStateToDefault() は
    // 保存された x/y がどのディスプレイにも含まれない場合に state を上書きし、
    // isMaximized と元の displayBounds を消してしまう。
    // そのため windowStateKeeper() を呼ぶ前に元の値を直接読み出しておく。
    let rawSavedState = {};
    try {
      rawSavedState = require('jsonfile').readFileSync(
        require('path').join(app.getPath('userData'), 'window-state.json'),
      );
    } catch (err) {
      // 初回起動時などファイルが無い場合は無視
    }

    const mainWindowState = windowStateKeeper({
      defaultWidth: 1600,
      defaultHeight: 1000,
      maximize: false, // 正しいモニターに配置してから自前で maximize するため無効化
    });

    const windowBounds = resolveWindowBounds(rawSavedState, mainWindowState, electron.screen, {
      defaultWidth: 1600,
      defaultHeight: 1000,
    });

    mainWindow = new BrowserWindow({
      minWidth: 448,
      minHeight: 600,
      width: windowBounds.width,
      height: windowBounds.height,
      show: false,
      frame: false,
      backgroundColor: '#17242D',
      title: process.env.NAIR_PRODUCT_NAME,
      ...(windowBounds.x !== undefined && windowBounds.y !== undefined
        ? { x: windowBounds.x, y: windowBounds.y }
        : {}),
      webPreferences: {
        nodeIntegration: true,
        webviewTag: true,
        contextIsolation: false,
        ...(devHostsPartition ? { partition: devHostsPartition } : {}),
      },
    });

    remote.enable(mainWindow.webContents);
    mainWindowState.manage(mainWindow); // maximize: false なのでリスナー登録のみ
    if (windowBounds.shouldMaximize) {
      mainWindow.maximize();
    }
    mainWindow.removeMenu();
    mainWindow.loadURL(`${global.indexUrl}?windowId=main`);

    // Open DevTools in development mode if configured
    if (process.env.NAIR_PRODUCTION_DEBUG) {
      // Delay DevTools opening slightly to avoid interfering with startup
      setTimeout(() => openDevTools(), 100);
    }

    // Close splash when main window content is loaded
    mainWindow.webContents.once('did-finish-load', () => {
      // Give Vue a moment to render before showing
      setTimeout(() => {
        // OBS IPC接続失敗等でシャットダウンが先行し、mainWindowが破棄済みの場合がある
        if (!mainWindow.isDestroyed()) {
          mainWindow.show();
        }
        closeSplashWindow();
      }, 100);
    });

    // Ensure splash is closed on error
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
      console.error('[RENDERER] did-fail-load:', errorCode, errorDescription, validatedURL);
      closeSplashWindow();
    });

    mainWindow.webContents.on('render-process-gone', (event, details) => {
      console.error('[RENDERER] render-process-gone:', JSON.stringify(details));
    });

    mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
      const levelName = ['verbose', 'info', 'warning', 'error'][level] || 'unknown';
      if (level >= 2) { // warning or error
        // intlify の fallback/missing 警告は動作上問題ないため除外
        if (message.includes('[intlify] Fall back to translate') ||
            message.includes('[intlify] Not found') ||
            message.includes('modulo syntax is deprecated')) {
          return;
        }
        console.log(`[RENDERER-CONSOLE][${levelName}] ${message} (${sourceId}:${line})`);
      }
    });

    mainWindow.on('close', (e) => {
      console.log('[EXIT] mainWindow.on(close) event, allowMainWindowClose=', allowMainWindowClose);

      if (!shutdownStarted) {
        console.log('[EXIT] Starting shutdown sequence');
        shutdownStarted = true;
        safeSend(mainWindow, 'shutdown');

        // We give the main window 10 seconds to acknowledge a request
        // to shut down.  Otherwise, we just close it.
        appShutdownTimeout = setTimeout(() => {
          console.log('[EXIT] Shutdown timeout');
          allowMainWindowClose = true;
          if (!mainWindow.isDestroyed()) mainWindow.close();
        }, 10 * 1000);
      }

      if (!allowMainWindowClose) {
        console.log('[EXIT] Preventing close');
        e.preventDefault();
      } else {
        console.log('[EXIT] Allowing close');
      }
    });

    ipcMain.on('acknowledgeShutdown', () => {
      if (appShutdownTimeout) clearTimeout(appShutdownTimeout);
    });

    ipcMain.on('shutdownComplete', () => {
      console.log('[EXIT] shutdownComplete received');
      if (appShutdownTimeout) clearTimeout(appShutdownTimeout);
      allowMainWindowClose = true;
      console.log('[EXIT] Set allowMainWindowClose=true, scheduling mainWindow.close()...');

      // Schedule close on next tick to avoid race condition with close event
      setTimeout(() => {
        console.log('[EXIT] Calling mainWindow.close()...');
        if (!mainWindow.isDestroyed()) {
          mainWindow.close();
          console.log('[EXIT] mainWindow.close() returned, isDestroyed=', mainWindow.isDestroyed());
        }
      }, 0);
    });

    // Initialize the keylistener
    try {
      require('node-libuiohook').startHook();
    } catch (e) {
      console.error('Exception while loading node-libuiohook', e);
      await showRequiredSystemComponentInstallGuideDialog();
      exitWithCrashHandlerCleanup();
    }

    mainWindow.on('closed', () => {
      console.log('[EXIT] mainWindow closed event');

      // Ensure splash window is closed
      closeSplashWindow();

      const libuiohook = require('node-libuiohook');
      libuiohook.unregisterAllCallbacks();
      libuiohook.stopHook();
      console.log('[EXIT] Stopped libuiohook');

      getAppSession().flushStorageData();
      console.log('[EXIT] Storage data flushed');

      console.log('[EXIT] Scheduling app.exit(0) after crash handler termination');

      // Flush all pending logs before exiting
      flushLogBufferSync();

      // crash-handler-process.exe を終了させてから exit する。
      // terminateCrashHandler は tryConnect (非同期 connect→write) を使うため、
      // setTimeout でイベントループに逃がし送信完了の猶予を与える。
      exitWithCrashHandlerCleanup();
    });

    // Pre-initialize the child window
    childWindow = new BrowserWindow({
      parent: mainWindow,
      minimizable: false,
      show: false,
      frame: false,
      backgroundColor: '#17242D', // これいる?
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        ...(devHostsPartition ? { partition: devHostsPartition } : {}),
      },
    });

    remote.enable(childWindow.webContents);

    childWindow.removeMenu();

    // The child window is never closed, it just hides in the
    // background until it is needed.
    childWindow.on('close', (e) => {
      // shutdownStarted で判定すると、mainWindow の close が
      // renderer 側でキャンセルされてアプリが継続する場合でも
      // childWindow だけ実際に破棄されてしまう(N-AIR-APP-G8Y)。
      if (!allowMainWindowClose) {
        safeSend(childWindow, 'closeWindow');

        // Prevent the window from actually closing
        e.preventDefault();
      }
    });

    // if (process.env.NAIR_PRODUCTION_DEBUG || process.env.DEV_SERVER) openDevTools();

    // simple messaging system for services between windows
    // WARNING! the child window use synchronous requests and will be frozen
    // until main window asynchronous response
    const requests = {};

    function sendRequest(request, event = null) {
      if (!safeSend(mainWindow, 'services-request', request)) return;
      if (!event) return;
      requests[request.id] = Object.assign({}, request, { event });
    }

    // use this function to call some service method from the main process
    function callService(resource, method, ...args) {
      sendRequest({
        jsonrpc: '2.0',
        method,
        params: {
          resource,
          args,
        },
      });
    }

    ipcMain.on('services-ready', () => {
      if (!childWindow.isDestroyed()) {
        // Only load the URL if the child window hasn't been initialized yet.
        // During HMR hot reload, the child window reloads itself independently,
        // so calling loadURL again would interrupt its own reload and break the
        // vuex state sync chain.
        const currentUrl = childWindow.webContents.getURL();
        if (!currentUrl || currentUrl === 'about:blank') {
          childWindow.loadURL(`${global.indexUrl}?windowId=child`);
        }
      }
    });

    ipcMain.on('services-request', (event, payload) => {
      sendRequest(payload, event);
    });

    ipcMain.on('services-response', (event, response) => {
      if (!requests[response.id]) return;
      requests[response.id].event.returnValue = response;
      delete requests[response.id];
    });

    ipcMain.on('services-message', (event, payload) => {
      const windows = BrowserWindow.getAllWindows();
      windows.forEach((window) => {
        if (window.id === mainWindow.id || window.isDestroyed()) return;
        safeSend(window, 'services-message', payload);
      });
    });

    if (isDevMode) {
      // require('devtron').install();
      // Vue dev tools appears to cause strange non-deterministic
      // interference with certain NodeJS APIs, especially asynchronous
      // IO from the renderer process.  Enable at your own risk.
      // const devtoolsInstaller = require('electron-devtools-installer');
      // devtoolsInstaller.default(devtoolsInstaller.VUEJS_DEVTOOLS);
      // setTimeout(() => {
      //   openDevTools();
      // }, 10 * 1000);
    }
  }

  const haDisableFile = path.join(app.getPath('userData'), 'HADisable');
  if (fs.existsSync(haDisableFile)) app.disableHardwareAcceleration();

  app.setAsDefaultProtocolClient('n-air-app');

  app.on('second-instance', (event, argv, cwd) => {
    console.log('second-instance', argv, cwd);
    SentryElectron.addBreadcrumb({
      category: 'app',
      message: 'second-instance',
      data: {
        argv,
        cwd,
      },
    });
    // Check for protocol links in the argv of the other process
    argv.forEach((arg) => {
      if (arg.match(/^n-air-app:\/\//)) {
        safeSend(mainWindow, 'protocolLink', arg);
      }
    });

    // Someone tried to run a second instance, we should focus our window.
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }

      mainWindow.focus();
    }
  });

  app.on('ready', async () => {
    const recoveryAlreadyAttempted = process.argv.includes('--obs-recovery-attempted');
    if (!recoveryAlreadyAttempted) {
      try {
        const recovery = await recoverOrphanedNairObsProcess();
        console.log('[OBS RECOVERY]', recovery);
        if (recovery.recovered) {
          app.relaunch({ args: [...process.argv.slice(1), '--obs-recovery-attempted'] });
          app.exit(0);
          return;
        }
      } catch (error) {
        console.error('[OBS RECOVERY] Failed to recover stale OBS process', error);
      }
    }

    // Show splash window immediately (skip in test environment)
    createSplashWindow();

    // バックグラウンドで起動時のクリーンアップ処理を実行（非ブロッキング）
    setTimeout(() => {
      // DevTools Extensions削除
      removePathWithRetry(path.join(app.getPath('userData'), 'DevTools Extensions'));

      // ログファイル切り詰め
      if (fs.existsSync(logFile) && fs.statSync(logFile).size > maxLogBytes) {
        const content = fs.readFileSync(logFile);
        fs.writeFileSync(logFile, '[LOG TRUNCATED]\n');
        fs.writeFileSync(logFile, content.slice(content.length - maxLogBytes), { flag: 'a' });
      }
    }, 0);

    // スプラッシュ表示を確実にするため、Updaterを少し遅延起動
    setTimeout(() => {
      if (process.env.NODE_ENV === 'production' || process.env.NAIR_FORCE_AUTO_UPDATE) {
        new Updater(startApp).run();
      } else {
        startApp();
      }
    }, 0);
  });

  ipcMain.on('openDevTools', () => {
    openDevTools();
  });

  ipcMain.on('window-showChildWindow', (event, windowOptions) => {
    if (windowOptions.size.width && windowOptions.size.height) {
      // Center the child window on the main window

      // For some unknown reason, electron sometimes gets into a
      // weird state where this will always fail.  Instead, we
      // should recover by simply setting the size and forgetting
      // about the bounds.
      try {
        childWindow.restore();

        // 前回の最小サイズ制約をリセット(再利用時に古い制約が残っていると setBounds が効かない)
        childWindow.setMinimumSize(0, 0);

        const bounds = mainWindow.getBounds();
        const childX = bounds.x + bounds.width / 2 - windowOptions.size.width / 2;
        const childY = bounds.y + bounds.height / 2 - windowOptions.size.height / 2;

        if (windowOptions.center) {
          childWindow.setBounds({
            x: Math.floor(childX),
            y: Math.floor(childY),
            width: windowOptions.size.width,
            height: windowOptions.size.height,
          });
        }

        childWindow.setResizable(windowOptions.resizable !== false);
        childWindow.show();

        // setBounds の適用後に最小サイズを設定（遅延させることで確実に反映）
        setTimeout(() => {
          if (!childWindow.isDestroyed()) {
            childWindow.setMinimumSize(windowOptions.size.width, windowOptions.size.height);
          }
        }, 10);
      } catch (err) {
        console.log('Recovering from error:', err);

        if (!childWindow.isDestroyed()) {
          childWindow.setMinimumSize(windowOptions.size.width, windowOptions.size.height);
          childWindow.setSize(windowOptions.size.width, windowOptions.size.height);
          childWindow.center();
        }
      }

      if (!childWindow.isDestroyed()) {
        childWindow.focus();
      }
    }
  });

  const windowCleanupWaiter = new WindowCleanupWaiter();
  ipcMain.handle('require-wait-window-cleanup', async (_event, windowId, enable) => {
    switch (windowId) {
      case 'main':
        windowId = mainWindow.id;
        break;
      case 'child':
        windowId = childWindow.id;
        break;
    }
    await windowCleanupWaiter.set(windowId, enable);
  });
  ipcMain.handle('wait-window-cleanup', async (_event, windowId) => {
    switch (windowId) {
      case 'main':
        windowId = mainWindow.id;
        break;
      case 'child':
        windowId = childWindow.id;
        break;
    }
    await windowCleanupWaiter.wait(windowId);
  });

  ipcMain.on('window-closeChildWindow', (event) => {
    // never close the child window, hide it instead
    if (childWindow.isDestroyed()) return;

    // ウィンドウの状態をリセット（次回の再利用時のために）
    childWindow.setMinimumSize(0, 0);
    childWindow.setResizable(true);

    childWindow.hide();
  });

  ipcMain.on('window-focusMain', () => {
    mainWindow.focus();
  });

  /**
   * 番組作成・編集画面からログアウトを封じる処理
   * rendererプロセスからは遷移前に止められないのでここに実装がある
   * @see https://github.com/electron/electron/pull/11679#issuecomment-359180722
   **/

  function preventLogout(e, url) {
    const urlObj = new URL(url);
    const liveHostname = new URL(devHostsTransformUrl('https://live.nicovideo.jp')).hostname;
    const live2Hostname = new URL(devHostsTransformUrl('https://live2.nicovideo.jp')).hostname;
    const isLogout =
      /^https?:$/.test(urlObj.protocol) &&
      (urlObj.hostname === liveHostname || urlObj.hostname === live2Hostname) &&
      /^\/logout$/.test(urlObj.pathname);
    if (isLogout) {
      e.preventDefault();
    }
  }

  ipcMain.on('window-preventLogout', (event, id) => {
    const window = BrowserWindow.fromId(id);
    window.webContents.on('will-navigate', preventLogout);
  });

  /**
   * 新ウィンドウ表示は既定のブラウザで開かせる処理
   * rendererプロセスからは処理を止められないのでここに実装がある
   * @see https://github.com/electron/electron/pull/11679#issuecomment-359180722
   **/

  ipcMain.on('window-preventNewWindow', (_event, id) => {
    const window = BrowserWindow.fromId(id);
    if (!window || window.webContents.isDestroyed()) return;
    window.webContents.setWindowOpenHandler((details) => {
      if (/^https?:/.test(details.url)) {
        shell.openExternal(details.url).catch((e) => console.error('shell.openExternal failed:', e));
      }
      return { action: 'deny' };
    });
  });

  // The main process acts as a hub for various windows
  // syncing their vuex stores.
  const registeredStores = {};

  ipcMain.on('vuex-register', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const windowId = win.id;

    // Register can be received multiple times if the window is
    // refreshed.  We only want to register it once.
    if (!registeredStores[windowId]) {
      registeredStores[windowId] = win;
      console.log('Registered vuex stores: ', Object.keys(registeredStores));

      // Make sure we unregister is when it is closed
      win.on('closed', () => {
        delete registeredStores[windowId];
        console.log('Registered vuex stores: ', Object.keys(registeredStores));
      });
    }

    if (windowId !== mainWindow.id) {
      // Tell the mainWindow to send its current store state
      // to the newly registered window

      safeSend(mainWindow, 'vuex-sendState', windowId);
    }
  });

  // Proxy vuex-mutation events to all other subscribed windows
  ipcMain.on('vuex-mutation', (event, mutation) => {
    const senderWindow = BrowserWindow.fromWebContents(event.sender);

    if (senderWindow && !senderWindow.isDestroyed()) {
      const windowId = senderWindow.id;

      Object.keys(registeredStores)
        .filter((id) => id !== windowId.toString())
        .forEach((id) => {
          const win = registeredStores[id];
          safeSend(win, 'vuex-mutation', mutation);
        });
    }
  });

  ipcMain.on('showErrorAlert', () => {
    safeSend(mainWindow, 'showErrorAlert');
  });

  ipcMain.on('webContents-enableRemote', (e, id) => {
    const contents = webContents.fromId(id);
    if (contents.isDestroyed()) return;
    remote.enable(contents);
    e.returnValue = null;
  });

  ipcMain.on('mainwindow-operation', (e, key, a, b) => {
    e.returnValue = mainWindow[key](a, b);
  });

  ipcMain.handle('recollectUserSessionCookie', async () => {
    await recollectUserSessionCookie();
  });

  ipcMain.on('getWindowIds', (e) => {
    e.returnValue = {
      main: mainWindow.id,
      child: childWindow.id,
    };
  });

  const I18N_NOT_FOUND_KEYS_FILE = 'i18n-not-found-keys.txt'; // in current directory
  ipcMain.handle('loadI18nNotFoundKeys', async () => {
    if (process.env.NODE_ENV !== 'production') {
      // dev 実行でのみ読み込む
      if (fs.existsSync(I18N_NOT_FOUND_KEYS_FILE)) {
        const keys = fs
          .readFileSync(I18N_NOT_FOUND_KEYS_FILE, 'utf-8')
          .split('\n')
          .map((l) => l.trimEnd())
          .filter(Boolean);
        console.log(`file ${I18N_NOT_FOUND_KEYS_FILE} loaded: ${keys.length} keys`);
        return keys;
      } else {
        console.warn(`file ${I18N_NOT_FOUND_KEYS_FILE} not found`);
      }
    }
    return [];
  });
  ipcMain.handle('appendI18nNotFoundKeys', async (_e, /** string[] | string */ keys) => {
    if (process.env.NODE_ENV !== 'production') {
      if (!Array.isArray(keys)) {
        keys = [keys];
      }
      fs.appendFileSync(I18N_NOT_FOUND_KEYS_FILE, keys.flatMap((line) => [line, '\n']).join(''));
    }
  });

  ipcMain.handle(
    'fetch',
    /**
     * @param {import('electron').IpcMainInvokeEvent} _e
     * @param {string} url
     * @param {RequestInit} options
     * @returns {Promise<import('./app/util/fetchViaMainProcess.ts').MainProcessFetchResponse>}
     * */
    async (_e, url, options) => {
      return fetchViaElectronNet(net, url, options);
    },
  );
}
