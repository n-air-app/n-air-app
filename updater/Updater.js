// This is the entry point to the auto-updater, and should
// be required by the main electron process.

const { autoUpdater } = require('electron-updater');
const { BrowserWindow, ipcMain } = require('electron');
const semver = require('semver');
const path = require('path');

class Updater {
  constructor(logStartupMilestone = () => {}, onUpdaterClosed = () => {}) {
    this.logStartupMilestone = logStartupMilestone;
    this.onUpdaterClosed = onUpdaterClosed;
  }

  run() {
    this.updateState = {};
    this.cancellationToken = undefined;

    this.bindListeners();

    autoUpdater.autoDownload = false;

    // 未パッケージ状態では checkForUpdates() が isUpdaterActive() でスキップされるため、
    // 開発用フラグが立っている場合は強制有効化する。
    if (process.env.NAIR_FORCE_AUTO_UPDATE) {
      autoUpdater.forceDevUpdateConfig = true;
    }

    this.logStartupMilestone('update-check-started');

    autoUpdater
      .checkForUpdates()
      .then((result) => {
        // Store cancellationToken from checkForUpdates result
        if (result && result.cancellationToken) {
          this.cancellationToken = result.cancellationToken;
        }
      })
      .catch(() => {
        // The error event normally handles failures, but also finish here in case it is not emitted.
        this.closeUpdater();
      });
  }

  closeUpdater() {
    if (this.finished) return;
    this.logStartupMilestone('update-check-finished');

    if (this.cancellationToken) {
      this.cancellationToken.cancel();
      this.cancellationToken = null;
    }

    this.finished = true;
    if (this.browserWindow && !this.browserWindow.isDestroyed()) this.browserWindow.close();
    this.onUpdaterClosed();
  }

  // PRIVATE

  isUnskippableUpdate(currentVersion, newVersion) {
    const currentVer = semver.parse(currentVersion);
    const newVer = semver.parse(newVersion);
    if (!currentVer || !newVer) {
      return true;
    }
    if (currentVer.major !== newVer.major) {
      return true;
    }
    if (currentVer.minor !== newVer.minor) {
      return true;
    }
    return false;
  }

  textToLines(text) {
    return text.split('\n');
  }

  bindListeners() {
    autoUpdater.on('update-available', (info) => {
      this.logStartupMilestone('update-available');
      this.updateState.asking = true;
      this.updateState.releaseNotes = this.textToLines(info.releaseNotes);
      this.updateState.releaseDate = info.releaseDate;
      this.updateState.fileSize = info.files[0].size;
      this.updateState.version = info.version;
      this.updateState.percent = 0;
      this.updateState.isUnskippable = this.isUnskippableUpdate(
        process.env.NAIR_VERSION,
        info.version,
      );
      console.log(`oldVersion: ${process.env.NAIR_VERSION}
newVersion: ${info.version}
isUnskippable: ${this.updateState.isUnskippable}`);
      // cancellationToken is now obtained from checkForUpdates() result
      this.browserWindow = this.initWindow();
      this.pushState();
    });

    ipcMain.on('autoUpdate-startDownload', () => {
      this.updateState.asking = false;
      autoUpdater.downloadUpdate(this.cancellationToken);
      this.pushState();
    });

    autoUpdater.on('update-not-available', () => {
      this.logStartupMilestone('update-not-available');
      this.closeUpdater();
    });

    autoUpdater.on('download-progress', (progress) => {
      this.updateState.percent = progress.percent;
      this.updateState.bytesPerSecond = progress.percent;

      if (progress.percent === 100) {
        this.updateState.installing = true;
      }

      this.pushState();
    });

    ipcMain.on('autoUpdate-cancelDownload', () => {
      if (this.cancellationToken) {
        this.cancellationToken.cancel();
        this.cancellationToken = null;
      }
      this.closeUpdater();
    });

    autoUpdater.on('update-downloaded', () => {
      this.updateState.installing = true;
      this.pushState();
      autoUpdater.quitAndInstall();
    });

    autoUpdater.on('error', () => {
      this.logStartupMilestone('update-check-error');
      this.closeUpdater();
    });

    ipcMain.on('autoUpdate-getState', () => {
      this.pushState();
    });
  }

  initWindow() {
    const browserWindow = new BrowserWindow({
      width: 596,
      height: 369,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
      },
      useContentSize: true,
      title: `${process.env.NAIR_PRODUCT_NAME} - Ver: ${process.env.NAIR_VERSION}`,
      frame: true,
      closable: !this.updateState.isUnskippable,
      resizable: false,
      show: false,
    });

    require('@electron/remote/main').enable(browserWindow.webContents);

    browserWindow.setMenuBarVisibility(false);

    browserWindow.on('ready-to-show', () => {
      browserWindow.show();
    });

    browserWindow.on('closed', () => {
      if (this.cancellationToken) {
        this.cancellationToken.cancel();
        this.cancellationToken = null;
      }
      this.browserWindow = null;
      if (!this.finished) {
        this.finished = true;
        this.logStartupMilestone('update-check-finished');
        this.onUpdaterClosed();
      }
    });

    if (process.env.NODE_ENV !== 'production') {
      browserWindow.webContents.openDevTools({ mode: 'undocked' });
    }

    browserWindow.loadURL('file://' + path.join(__dirname, 'index.html'));

    return browserWindow;
  }

  pushState() {
    if (this.browserWindow && !this.browserWindow.isDestroyed()) {
      this.browserWindow.send('autoUpdate-pushState', this.updateState);
    }
  }
}

exports.Updater = Updater;
