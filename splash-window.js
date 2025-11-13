const { BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

let splashWindow = null;

function createSplashWindow() {
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
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Read nvoice.png and convert to base64
  const nvoiceImagePath = path.join(__dirname, 'media', 'images', 'nvoice.png');
  const nvoiceImageBase64 = fs.readFileSync(nvoiceImagePath).toString('base64');
  const nvoiceImageDataUrl = `data:image/png;base64,${nvoiceImageBase64}`;

  const splashHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body {
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100vh;
          background: #17242D;
          font-family: 'Segoe UI', sans-serif;
          position: relative;
        }
        .logo {
          font-size: 48px;
          color: #FFFFFF;
          font-weight: 300;
          margin-bottom: 30px;
          letter-spacing: 2px;
        }
        .text {
          color: #FFFFFF;
          font-size: 16px;
          opacity: 0.7;
          margin-bottom: 20px;
        }
        .spinner {
          width: 40px;
          height: 40px;
          border: 3px solid rgba(255, 255, 255, 0.1);
          border-top-color: #FFFFFF;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        .nvoice-logo {
          position: absolute;
          bottom: 5px;
          right: 5px;
          width: 140px;
          height: auto;
          opacity: 1.0;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      </style>
    </head>
    <body>
      <div class="logo">N Air</div>
      <div class="text">Initializing...</div>
      <div class="spinner"></div>
      <img src="${nvoiceImageDataUrl}" alt="N Voice" class="nvoice-logo">
    </body>
    </html>
  `;

  splashWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(splashHtml));
  splashWindow.show();
}

function closeSplashWindow() {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.close();
    splashWindow = null;
  }
}

module.exports = {
  createSplashWindow,
  closeSplashWindow,
};
