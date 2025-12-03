const { BrowserWindow } = require('electron');
const path = require('node:path');

let splashWindow = null;

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

  splashWindow.loadFile(path.join(__dirname, 'index.html'));
  splashWindow.show();
}

function closeSplashWindow() {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.destroy();
    splashWindow = null;
  }
}

module.exports = {
  createSplashWindow,
  closeSplashWindow,
};
