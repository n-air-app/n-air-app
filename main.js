'use strict';

////////////////////////////////////////////////////////////////////////////////
// Set Up Environment Variables
////////////////////////////////////////////////////////////////////////////////
const pjson = require('./package.json');

if (pjson.env === 'production') {
  process.env.NODE_ENV = 'production';
}
if (pjson.name === 'n-air-app-unstable') {
  process.env.NAIR_UNSTABLE = true;
}
if (process.env.NODE_ENV !== 'production' && process.env.NAIR_UNSTABLE) {
  pjson.name = 'n-air-app-unstable';
}
if (pjson.name === 'n-air-app-preview') {
  process.env.NAIR_PREVIEW = true;
}
if (pjson.name === 'n-air-app-ipc') {
  process.env.NAIR_IPC = true;
}
process.env.NAIR_VERSION = pjson.version;
process.env.NAIR_PRODUCT_NAME = pjson.buildProductName;

if (!process.env.NAIR_LICENSE_API_KEY && pjson.getlicensenair_key) {
  process.env.NAIR_LICENSE_API_KEY = pjson.getlicensenair_key;
}

////////////////////////////////////////////////////////////////////////////////
// Modules and other Requires
////////////////////////////////////////////////////////////////////////////////
const { app, BrowserWindow, ipcMain, session, crashReporter, dialog, webContents, shell } = require('electron');
const electron = require('electron');
const fs = require('fs');
const { Updater } = require('./updater/Updater.js');
const uuid = require('uuid/v4');
const rimraf = require('rimraf');
const path = require('path');
const windowStateKeeper = require('electron-window-state');
const { URL } = require('url');
const obs = require('obs-studio-node');

app.disableHardwareAcceleration();

////////////////////////////////////////////////////////////////////////////////
// Main Program
////////////////////////////////////////////////////////////////////////////////

function log(...args) {
  if (!process.env.NAIR_DISABLE_MAIN_LOGGING) {
    console.log(...args);
  }
}

// We use a special cache directory for running tests
if (process.env.NAIR_CACHE_DIR) {
  app.setPath('appData', process.env.NAIR_CACHE_DIR);
}
app.setPath('userData', path.join(app.getPath('appData'), pjson.name));

if (process.argv.includes('--clearCacheDir')) {
  // __installer.exe は electron-updater 差分アップデートの比較元になるので消してはいけない
  const rmPath = path.join(app.getPath('userData'), '!(__installer.exe)');
  log('clear cache directory!: ', rmPath);
  rimraf.sync(rmPath);
}

// Windows
let mainWindow;
let childWindow;

// Somewhat annoyingly, this is needed so that the child window
// can differentiate between a user closing it vs the app
// closing the windows before exit.
let allowMainWindowClose = false;
let shutdownStarted = false;
let appShutdownTimeout;

global.indexUrl = 'file://' + __dirname + '/index.html';

function openDevTools() {
  childWindow.webContents.openDevTools({ mode: 'undocked' });
  mainWindow.webContents.openDevTools({ mode: 'undocked' });
}

function startApp() {
  const isDevMode = (process.env.NODE_ENV !== 'production') && (process.env.NODE_ENV !== 'test');

  { // Initialize obs-studio-server
    // Set up environment variables for IPC.
    process.env.NAIR_IPC_PATH = "nair-".concat(uuid());
    process.env.NAIR_IPC_USERDATA = app.getPath('userData');
    // Host a new IPC Server and connect to it.
    obs.IPC.host(process.env.NAIR_IPC_PATH);
    obs.NodeObs.SetWorkingDirectory(path.join(
      app.getAppPath().replace('app.asar', 'app.asar.unpacked'),
      'node_modules',
      'obs-studio-node')
    );
  }

  const Raven = require('raven-js');

  function handleFinishedReport() {
    dialog.showErrorBox(`予期せぬエラー`,
    '予期しないエラーが発生したため、アプリケーションをシャットダウンします。ご不便をおかけして申し訳ありません。\n' +
    'この件に関する情報はデバッグ目的で送信されました。不具合を解決するためにご協力いただきありがとうございます。');

    if (app) {
      app.quit();
    }
  }

  if (pjson.env === 'production') {
    const params = !!process.env.NAIR_UNSTABLE
      ? {project: '5372801', key: '819e76e51864453aafd28c6d0473881f'} // crash-reporter-unstable
      : {project: '1520076', key: 'd965eea4b2254c2b9f38d2346fb8a472'}; // crash-reporter

    Raven.config(`https://${params.key}@o170115.ingest.sentry.io/${params.project}`, {
      release: process.env.NAIR_VERSION
    }).install(function (err, initialErr, eventId) {
      handleFinishedReport();
    });

    crashReporter.start({
      productName: 'n-air-app',
      companyName: 'n-air-app',
      submitURL:
        `https://o170115.ingest.sentry.io/api/${params.project}/minidump/` +
        `?sentry_key=${params.key}`,
      extra: {
        version: pjson.version,
        processType: 'main'
      }
    });
  }

  const mainWindowState = windowStateKeeper({
    defaultWidth: 1600,
    defaultHeight: 1000
  });

  const mainWindowIsVisible = electron.screen.getAllDisplays().some(display => (
    display.workArea.x < mainWindowState.x + mainWindowState.width &&
    mainWindowState.x < display.workArea.x + display.workArea.width &&
    display.workArea.y < mainWindowState.y &&
    mainWindowState.y < display.workArea.y + display.workArea.height
  ));

  mainWindow = new BrowserWindow({
    minWidth: 800,
    minHeight: 600,
    width: mainWindowState.width,
    height: mainWindowState.height,
    show: false,
    frame: false,
    title: process.env.NAIR_PRODUCT_NAME,
    ...(mainWindowIsVisible ? {
      x: mainWindowState.x,
      y: mainWindowState.y
    } : {})
  });

  mainWindowState.manage(mainWindow);

  mainWindow.setMenu(null);

  // wait until devtools will be opened and load app into window
  // it allows to start application with clean cache
  // and handle breakpoints on startup
  const LOAD_DELAY = 2000;
  setTimeout(() => {
    mainWindow.loadURL(`${global.indexUrl}?windowId=main`);
  }, isDevMode ? LOAD_DELAY : 0);

  mainWindow.on('close', e => {
    if (!shutdownStarted) {
      shutdownStarted = true;
      childWindow.destroy();
      mainWindow.send('shutdown');

      // We give the main window 10 seconds to acknowledge a request
      // to shut down.  Otherwise, we just close it.
      appShutdownTimeout = setTimeout(() => {
        allowMainWindowClose = true;
        if (!mainWindow.isDestroyed()) mainWindow.close();
      }, 10 * 1000);
    }

    if (!allowMainWindowClose) e.preventDefault();
  });

  ipcMain.on('acknowledgeShutdown', () => {
    if (appShutdownTimeout) clearTimeout(appShutdownTimeout);
  });

  ipcMain.on('shutdownComplete', () => {
    allowMainWindowClose = true;
    mainWindow.close();
  });

  // Initialize the keylistener
  require('node-libuiohook').startHook();

  mainWindow.on('closed', () => {
    require('node-libuiohook').stopHook();
    session.defaultSession.flushStorageData();
    app.quit();
  });

  // Pre-initialize the child window
  childWindow = new BrowserWindow({
    parent: mainWindow,
    minimizable: false,
    show: false,
    frame: false
  });

  childWindow.setMenu(null);

  // The child window is never closed, it just hides in the
  // background until it is needed.
  childWindow.on('close', e => {
    if (!shutdownStarted) {
      childWindow.send('closeWindow');

      // Prevent the window from actually closing
      e.preventDefault();
    }
  });


  // simple messaging system for services between windows
  // WARNING! the child window use synchronous requests and will be frozen
  // until main window asynchronous response
  const requests = { };

  function sendRequest(request, event = null) {
    mainWindow.webContents.send('services-request', request);
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
        args
      }
    });
  }

  ipcMain.on('services-ready', () => {
    childWindow.loadURL(`${global.indexUrl}?windowId=child`);
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
    windows.forEach(window => {
      if (window.id === mainWindow.id || window.isDestroyed()) return;
      window.webContents.send('services-message', payload);
    });
  });


  if (isDevMode) {
    require('devtron').install();

    // Vue dev tools appears to cause strange non-deterministic
    // interference with certain NodeJS APIs, expecially asynchronous
    // IO from the renderer process.  Enable at your own risk.

    // const devtoolsInstaller = require('electron-devtools-installer');
    // devtoolsInstaller.default(devtoolsInstaller.VUEJS_DEVTOOLS);

    // setTimeout(() => {
    //   openDevTools();
    // }, 10 * 1000);
  }
}

app.setAsDefaultProtocolClient('nair');

// This ensures that only one copy of our app can run at once.
const shouldQuit = app.makeSingleInstance(argv => {
  // Check for protocol links in the argv of the other process
  argv.forEach(arg => {
    if (arg.match(/^nair:\/\//)) {
      mainWindow.send('protocolLink', arg);
    }
  });

  // Someone tried to run a second instance, we should focus our window.
  if (mainWindow) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }

    mainWindow.focus();
  }
});

if (shouldQuit) {
  app.exit();
}

function copyFile(src, dest) {
  if (!fs.existsSync(src)) {
    log(`copyFile: ${src} not found!`);
    return;
  }

  const stat = fs.statSync(src);

  if (fs.existsSync(dest)) {
    const cache = fs.statSync(dest);
    if (stat.size === cache.size && stat.mtime === cache.mtime) {
      log('copyFile: the same file exists. skip.');
      return;
    }
  }

  try {
    fs.copyFileSync(src, dest);
    fs.utimesSync(dest, stat.atime, stat.mtime);
  } catch (e) {
    log(`copyFile Error: ${e.name}: ${e.message}`);
  }
}

app.on('ready', () => {
  if ((process.env.NODE_ENV === 'production') || process.env.NAIR_FORCE_AUTO_UPDATE) {

    // copy the original installer file so that it can be found for differential updating
    const nsisInstallerFileName = '__installer.exe';
    const installerPath = path.join(app.getPath('appData'), process.env.NAIR_PRODUCT_NAME, nsisInstallerFileName);
    const cachePath = path.join(app.getPath('userData'), nsisInstallerFileName);
    log(`copying ${installerPath} to ${cachePath}...`);
    copyFile(installerPath, cachePath);

    (new Updater(startApp)).run();
  } else {
    startApp();
  }
});

app.on('quit', (e, exitCode) => {
  obs.IPC.disconnect();
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
      const mainWindowBounds = mainWindow.getBounds();
      const mainWindowDisplay = electron.screen.getDisplayMatching(mainWindowBounds);
      const targetWorkArea = mainWindowDisplay.workArea;

      const width = Math.min(windowOptions.size.width, targetWorkArea.width);
      const height = Math.min(windowOptions.size.height, targetWorkArea.height);

      childWindow.show();
      childWindow.restore();
      childWindow.setMinimumSize(width, height);

      if (windowOptions.center) {
        const baseChildY = mainWindowBounds.y;
        const overflowsBottom = Math.max(0, baseChildY + height - targetWorkArea.y - targetWorkArea.height);
        const overflowsTop = Math.max(0, targetWorkArea.y - baseChildY);

        const baseChildX = (mainWindowBounds.x + (mainWindowBounds.width / 2)) - (width / 2);
        const overflowsRight = Math.max(0, baseChildX + width - targetWorkArea.x - targetWorkArea.width);
        const overflowsLeft = Math.max(0, targetWorkArea.x - baseChildX);

        const childX = baseChildX + overflowsLeft - overflowsRight;
        const childY = baseChildY + overflowsTop - overflowsBottom;

        childWindow.setBounds({
          x: Math.floor(childX),
          y: Math.floor(childY),
          width,
          height
        });
      }
    } catch (err) {
      log('Recovering from error:', err);

      const workAreaSize = electron.screen.getPrimaryDisplay().workAreaSize;
      const width = Math.min(windowOptions.size.width, workAreaSize.width);
      const height = Math.min(windowOptions.size.height, workAreaSize.height);

      childWindow.setMinimumSize(width, height);
      childWindow.setSize(width, height);
      childWindow.center();
    }

    childWindow.focus();
  }

});


ipcMain.on('window-closeChildWindow', (event) => {
  // never close the child window, hide it instead
  childWindow.hide();
});


ipcMain.on('window-focusMain', () => {
  mainWindow.focus();
});

function preventClose(e) {
  if (!shutdownStarted) {
    e.preventDefault();
  }
}

ipcMain.on('window-preventClose', (event, id) => {
  const window = BrowserWindow.fromId(id);
  window.addListener('close', preventClose);
});

ipcMain.on('window-allowClose', (event, id) => {
  const window = BrowserWindow.fromId(id);
  window.removeListener('close', preventClose);
});

/**
 * 番組作成・編集画面からログアウトを封じる処理
 * rendererプロセスからは遷移前に止められないのでここに実装がある
 * @see https://github.com/electron/electron/pull/11679#issuecomment-359180722
 **/
function preventLogout(e, url) {
  const urlObj = new URL(url);
  const isLogout = (
    /^https?:$/.test(urlObj.protocol) &&
    /^live2?\.nicovideo\.jp$/.test(urlObj.hostname) &&
    /^\/logout$/.test(urlObj.pathname)
  );
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
function preventNewWindow(e, url) {
  e.preventDefault();
  shell.openExternal(url);
}

ipcMain.on('window-preventNewWindow', (_event, id) => {
  const window = BrowserWindow.fromId(id);
  window.webContents.on('new-window', preventNewWindow);
});

// The main process acts as a hub for various windows
// syncing their vuex stores.
let registeredStores = {};

ipcMain.on('vuex-register', event => {
  let win = BrowserWindow.fromWebContents(event.sender);
  let windowId = win.id;

  // Register can be received multiple times if the window is
  // refreshed.  We only want to register it once.
  if (!registeredStores[windowId]) {
    registeredStores[windowId] = win;
    log('Registered vuex stores: ', Object.keys(registeredStores));

    // Make sure we unregister is when it is closed
    win.on('closed', () => {
      delete registeredStores[windowId];
      log('Registered vuex stores: ', Object.keys(registeredStores));
    });
  }

  if (windowId !== mainWindow.id) {
    // Tell the mainWindow to send its current store state
    // to the newly registered window

    mainWindow.webContents.send('vuex-sendState', windowId);
  }
});

// Proxy vuex-mutation events to all other subscribed windows
ipcMain.on('vuex-mutation', (event, mutation) => {
  const senderWindow = BrowserWindow.fromWebContents(event.sender);

  if (senderWindow && !senderWindow.isDestroyed()) {
    const windowId = senderWindow.id;

    Object.keys(registeredStores).filter(id => id !== windowId.toString()).forEach(id => {
      const win = registeredStores[id];
      if (!win.isDestroyed()) win.webContents.send('vuex-mutation', mutation);
    });
  }
});

ipcMain.on('restartApp', () => {
  // prevent unexpected cache clear
  const args = process.argv.slice(1).filter(x => x !== '--clearCacheDir');

  app.relaunch( {args} );
  // Closing the main window starts the shut down sequence
  mainWindow.close();
});

ipcMain.on('requestSourceAttributes', (e, names) => {
  const sizes = require('obs-studio-node').getSourcesSize(names);

  e.sender.send('notifySourceAttributes', sizes);
});

ipcMain.on('requestPerformanceStatistics', (e) => {
  const stats = getObs().OBS_API_getPerformanceStatistics();

  e.sender.send('notifyPerformanceStatistics', stats);
});

ipcMain.on('webContents-preventNavigation', (e, id) => {
  webContents.fromId(id).on('will-navigate', e => {
    e.preventDefault();
  });
});

ipcMain.on('getMainWindowWebContentsId', e => {
  e.returnValue = mainWindow.webContents.id;
});
