const { BrowserWindow } = require('electron');
const path = require('node:path');

let splashWindow = null;
let latestStatus = { status: '起動準備中…', progress: 12 };

function createSplashWindow() {
  // Close existing splash window if it exists (for test app restarts)
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.destroy();
    splashWindow = null;
  }

  splashWindow = new BrowserWindow({
    width: 400,
    height: 300,
    frame: false,
    transparent: true,
    alwaysOnTop: false, // Updaterウィンドウの邪魔にならないようにfalseに変更
    skipTaskbar: true,
    resizable: false,
    backgroundColor: '#17242D',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  splashWindow.webContents.once('did-finish-load', () => {
    if (!splashWindow || splashWindow.isDestroyed()) return;
    splashWindow.webContents.send('splash-status', latestStatus);
  });
  splashWindow.loadFile(path.join(__dirname, 'index.html'));
  splashWindow.show();
}

function closeSplashWindow() {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.destroy();
    splashWindow = null;
  }
}

function updateSplashStatus(status, progress) {
  latestStatus = { status, progress };
  if (
    !splashWindow ||
    splashWindow.isDestroyed() ||
    splashWindow.webContents.isLoadingMainFrame()
  ) return;

  splashWindow.webContents.send('splash-status', latestStatus);
}

module.exports = {
  createSplashWindow,
  closeSplashWindow,
  updateSplashStatus,
};
