// @ts-check

const fs = require('fs');
const path = require('path');

/** @type {import('electron-builder').Configuration} */
const config = {
  appId: 'jp.nicovideo.nair',
  productName: 'N Air',
  icon: 'media/images/icon.ico',
  files: [
    'bundles',
    'node_modules',
    'vendor',
    'app/i18n',
    'updater/index.html',
    'updater/Updater.js',
    'splash/index.html',
    'splash/splash-window.js',
    'index.html',
    'main.js',
    'main-process/window-startup-state.js',
    'obs-api',
  ],
  extraFiles: [
    'scene-presets',
    { from: 'nvoice', to: 'nvoice', filter: ['**/*', '!near/src'] },
    'LICENSE',
    'AGREEMENT.sjis',
    'assets',
  ],
  detectUpdateChannel: false,
  afterPack: async context => {
    const localesDir = path.join(context.appOutDir, 'locales');
    if (fs.existsSync(localesDir)) {
      const files = fs.readdirSync(localesDir);
      files.forEach(file => {
        if (file !== 'en-US.pak' && file !== 'ja.pak') {
          fs.unlinkSync(path.join(localesDir, file));
        }
      });
      console.log('remove unnecessary locales files');
    }

    // Remove source map from nvoice/near (only in development builds)
    const bundleMapPath = path.join(context.appOutDir, 'nvoice', 'near', 'bundle.js.map');
    if (fs.existsSync(bundleMapPath)) {
      fs.unlinkSync(bundleMapPath);
      console.log('remove bundle.js.map from nvoice/near');
    }
  },
  publish: {
    provider: 'generic',
    useMultipleRangeRequest: false,
    channel: 'latest',
    url: 'https://n-air-app.nicovideo.jp/download/windows',
  },
  nsis: {
    license: 'AGREEMENT.sjis',
    oneClick: false,
    perMachine: true,
    allowToChangeInstallationDirectory: true,
    // eslint-disable-next-line no-template-curly-in-string
    artifactName: 'n-air-app-setup.${version}.${ext}',
    include: 'installer.nsh',
    warningsAsErrors: false,
  },
  win: {
    signtoolOptions: {
      publisherName: ['DWANGO Co.,Ltd.'],
      rfc3161TimeStampServer: 'http://timestamp.digicert.com',
      timeStampServer: 'http://timestamp.digicert.com',
    },
  },
  extraMetadata: {
    env: 'production',
  },
};

if (process.env.CERTIFICATE_SUBJECT_NAME) {
  // @ts-expect-error - signtoolOptions は型定義上 readonly だが、動的に設定する必要がある
  config.win.signtoolOptions.certificateSubjectName = process.env.CERTIFICATE_SUBJECT_NAME;
}

module.exports = config;
