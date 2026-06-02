/* eslint-disable import/first */
// window.eval override must execute before other imports to prevent eval usage in any imported module
import get from 'lodash/get';
import { I18nService } from 'services/i18n';

// eslint-disable-next-line no-eval
window['eval'] = global.eval = () => {
  throw new Error('window.eval() is disabled for security');
};

import path from 'path';
import util from 'util';

import * as Sentry from '@sentry/electron/renderer';
import { vueIntegration } from '@sentry/vue';
import ChildWindow from 'components/windows/ChildWindow.vue';
import OneOffWindow from 'components/windows/OneOffWindow.vue';
import tooltipDirective from 'directives/tooltip';
import electron from 'electron';
import { Settings } from 'luxon';
import { setupGlobalContextMenuForEditableElement } from 'util/menus/GlobalMenu';
import { createApp } from 'vue';
import { createI18n, type Locale, type Path } from 'vue-i18n';

import * as obs from '../obs-api';

import { AppService } from './services/app';
import Utils from './services/utils';
import { WindowsService } from './services/windows';
import { createStore } from './store';

const { ipcRenderer } = electron;

import * as remote from '@electron/remote';

const isProduction = process.env.NODE_ENV === 'production';

const windowId = Utils.getWindowId();

const logFunctions = ['log', 'info', 'warn', 'error'] as const;

function wrapLogFn(fn: (typeof logFunctions)[number]) {
  const old: Function = console[fn];
  console[fn] = (...args: any[]) => {
    const fixedArgs = args.map((arg) => {
      try {
        if (typeof arg === 'object' && arg !== null) {
          // Vue のプロキシオブジェクトを通常のオブジェクトに変換してログ出力
          return JSON.parse(JSON.stringify(arg));
        }
        return arg;
      } catch (e) {
        return `[Error: ${(e as Error).message}]`;
      }
    });
    old.apply(console, fixedArgs);

    const level = fn === 'log' ? 'info' : fn;

    sendLogMsg(level, ...fixedArgs);
  };
}

function sendLogMsg(level: string, ...args: any[]) {
  const serialized = args
    .map((arg) => {
      if (typeof arg === 'string') return arg;

      return util.inspect(arg);
    })
    .join(' ');

  ipcRenderer.send('logmsg', { level, sender: windowId, message: serialized });
}

logFunctions.forEach(wrapLogFn);

window.addEventListener('error', (e) => {
  sendLogMsg('error', e.error);
});

window.addEventListener('unhandledrejection', (e) => {
  sendLogMsg('error', e.reason);
});

if ((isProduction || process.env.NAIR_REPORT_TO_SENTRY) && !remote.process.env.NAIR_IPC) {
  Sentry.init(
    {
      sampleRate: /* isPreview ? */ 1.0 /* : 0.1 */,
      beforeSend(event) {
        // quota 対策: ユーザー側ネット環境起因またはアプリバグに起因しないノイズを除外する
        const NOISE_PATTERNS = [
          /Failed to make IPC call/,
          /ERR_ABORTED/,
          /ERR_FAILED/,
          /read ECONNRESET/,
          /network error/i,
          /Failed to fetch/,
        ];
        const messageText =
          (event.exception?.values?.[0]?.value) ?? event.message ?? '';
        if (NOISE_PATTERNS.some((re) => re.test(messageText))) {
          return null;
        }
        return event;
      },
    },
  );

  const oldConsoleError = console.error;

  console.error = (msg: string, ...params: any[]) => {
    oldConsoleError(msg, ...params);

    Sentry.withScope((scope) => {
      if (params[0] instanceof Error) {
        scope.setExtra('exception', params[0].stack);
      }

      scope.setExtra('console-args', JSON.stringify(params, null, 2));
      Sentry.captureMessage(msg, 'error');
    });
  };
}

require('./app.less');
require('./theme.less');
require('./theme2.less');

// Disable chrome default drag/drop behavior
document.addEventListener('dragover', (event) => event.preventDefault());
document.addEventListener('dragenter', (event) => event.preventDefault());
document.addEventListener('drop', (event) => event.preventDefault());
document.addEventListener('auxclick', (event) => event.preventDefault());

const locale = remote.app.getLocale();

export const apiInitErrorResultToMessage = (resultCode: obs.EVideoCodes) => {
  switch (resultCode) {
    case obs.EVideoCodes.NotSupported: {
      if (locale === 'ja') {
        return 'OBSの初期化に失敗しました。ビデオドライバーが古い、もしくはN Airがサポートしないシステムの可能性があります。';
      }
      return 'Failed to initialize OBS. Your video drivers may be out of date, or N Air may not be supported on your system.';
    }
    case obs.EVideoCodes.ModuleNotFound: {
      if (locale === 'ja') {
        return 'DirectXが見つかりませんでした。最新のDirectXをこちら<https://www.microsoft.com/en-us/download/details.aspx?id=35?> からインストールしてから、再度お試しください。';
      }
      return 'DirectX could not be found on your system. Please install the latest version of DirectX for your machine here <https://www.microsoft.com/en-us/download/details.aspx?id=35?> and try again.';
    }
    default: {
      if (locale === 'ja') {
        return 'OBSの初期化中に不明なエラーが発生しました';
      }
      return 'An unknown error was encountered while initializing OBS.';
    }
  }
};

const showDialog = (message: string): void => {
  remote.dialog.showErrorBox(locale === 'ja' ? '初期化エラー' : 'Initialization Error', message);
};

document.addEventListener('DOMContentLoaded', () => {
  createStore().then(async (store) => {
    const windowsService: WindowsService = WindowsService.instance();

    if (Utils.isMainWindow()) {
      // Services
      const appService: AppService = AppService.instance();

      // This is used for debugging
      // @ts-ignore
      window['obs'] = obs;

      // Host a new OBS server instance
      obs.IPC.host(remote.process.env.IPC_UUID);
      obs.NodeObs.SetWorkingDirectory(
        path.join(
          remote.app.getAppPath().replace('app.asar', 'app.asar.unpacked'),
          'node_modules',
          'obs-studio-node',
        ),
      );

      // Initialize crash handler
      ipcRenderer.send('register-in-crash-handler', { pid: process.pid, critical: false });

      // await this.obsUserPluginsService.initialize();

      // Initialize OBS API
      // basic.ini が存在しない場合、OBS はデフォルト値(1920x1080)で初期化するため、事前に確認する
      const fs = remote.require('fs') as typeof import('fs');
      appService.obsConfigExisted = fs.existsSync(
        path.join(appService.appDataDirectory, 'basic.ini'),
      );

      const apiResult = obs.NodeObs.OBS_API_initAPI(
        'en-US',
        appService.appDataDirectory,
        remote.process.env.NAIR_VERSION,
        SENTRY_MINIDUMP_URL,
      );

      if (apiResult !== obs.EVideoCodes.Success) {
        const message = apiInitErrorResultToMessage(apiResult);
        showDialog(message);

        ipcRenderer.send('unregister-in-crash-handler', { pid: process.pid });

        obs.NodeObs.InitShutdownSequence();
        obs.IPC.disconnect();

        electron.ipcRenderer.send('shutdownComplete');
        return;
      }

      ipcRenderer.on('closeWindow', () => windowsService.closeMainWindow());
      AppService.instance().load();
    } else {
      if (Utils.isChildWindow()) {
        ipcRenderer.on('closeWindow', () => windowsService.closeChildWindow());
      }
    }

    // setup vue-i18n plugin
    const i18nService: I18nService = I18nService.instance();
    await i18nService.load(); // load translations from a disk
    const notFoundKeys = new Set<string>();

    // load notFoundKeys from file
    if (!isProduction) {
      const keys: string[] = await ipcRenderer.invoke('loadI18nNotFoundKeys');
      keys.forEach((key) => notFoundKeys.add(key));
    }

    const i18n = createI18n({
      legacy: true,
      locale: i18nService.state.locale,
      fallbackLocale: i18nService.getFallbackLocale(),
      messages: i18nService.getLoadedDictionaries(),
      missing: ((locale: Locale, key: Path, _instance: unknown, _type: string) => {
        // vue-i18n v9: missing handler receives (locale, key, instance, type)
        // values are no longer passed - fallback is handled at each $t call site

        // Check if the key exists in the dictionary with a null value (intentional OBS fallback)
        const dictionaries = i18nService.getLoadedDictionaries();
        // Convert key path like "settings.Output['Streaming']['Preset']['ultrafast']"
        // to lodash-compatible path like "settings.Output.Streaming.Preset.ultrafast"
        const lodashPath = key.replace(/\['([^']+)'\]/g, '.$1');
        const value = get(dictionaries[locale], lodashPath);
        if (value === null) {
          // Key exists with null value - intentional, suppress warning
          return;
        }

        if (!isProduction) {
          // beware: enable following line only when investigating around i18n keys!
          // this adds huge amount of lines to console.

          // console.warn(`i18n missing key - ${key}`);
          if (!notFoundKeys.has(key)) {
            notFoundKeys.add(key);
            console.warn(`i18n missing key - ${key}: (フォールバックなし)`);
            if (process.env.NAIR_UPDATE_I18N_NOT_FOUND_KEYS) {
              ipcRenderer.invoke('appendI18nNotFoundKeys', key);
            }
          }
        }
        // Return nothing - vue-i18n will use the key itself as fallback text
      }) as any, // 型定義と実装が異なっているのでanyに飛ばす
      silentTranslationWarn: true,
      // vue-i18n v9: fallback警告を抑制（OBSの動的キーで大量に出るため）
      missingWarn: false,
      fallbackWarn: false,
    });

    I18nService.setVuei18nInstance(i18n.global);

    Settings.defaultLocale = i18nService.state.locale.split('-')[0];

    // create a root Vue component
    const windowId = Utils.getCurrentUrlParams().windowId;

    let rootComponent;
    if (windowId === 'child') {
      rootComponent = ChildWindow;
    } else if (windowId === 'main') {
      const componentName = windowsService.state[windowId].componentName;
      rootComponent = windowsService.components[componentName];
    } else {
      rootComponent = OneOffWindow;
    }

    const app = createApp(rootComponent);
    app.directive('tooltip', tooltipDirective);
    app.use(store);
    app.use(i18n);

    // vue-i18n v9: missing handler no longer receives $t call values,
    // so { fallback: '...' } must be handled at the template $t call site.
    // When a key is missing, t() returns the key itself - we detect that and return the fallback.
    const globalT = app.config.globalProperties.$t;
    app.config.globalProperties.$t = function (key: string, ...args: any[]): string {
      const result: string = (globalT as (...a: any[]) => string).call(this, key, ...args);
      const options = args[0];
      if (options && typeof options.fallback === 'string' && result === key) {
        return options.fallback;
      }
      return result;
    };

    if ((isProduction || process.env.NAIR_REPORT_TO_SENTRY) && !remote.process.env.NAIR_IPC) {
      Sentry.addIntegration(vueIntegration({ app }));
    }

    app.mount('#app');

    Sentry.getCurrentScope().setTag('windowId', windowId);

    setupGlobalContextMenuForEditableElement();
  });
});

if (Utils.isDevMode()) {
  window.addEventListener('error', () => ipcRenderer.send('showErrorAlert'));
  window.addEventListener('keyup', (ev) => {
    if (ev.key === 'F12') electron.ipcRenderer.send('openDevTools');
  });
}

if (process.env.DEV_SERVER) {
  electron.ipcRenderer.send('openDevTools');
}
