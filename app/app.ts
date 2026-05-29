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
import { init as sentryVueInit } from '@sentry/vue';
import ChildWindow from 'components/windows/ChildWindow.vue';
import OneOffWindow from 'components/windows/OneOffWindow.vue';
import tooltipDirective from 'directives/tooltip';
import electron from 'electron';
import { Settings } from 'luxon';
import { setupGlobalContextMenuForEditableElement } from 'util/menus/GlobalMenu';
import Vue from 'vue';
import VueI18n from 'vue-i18n';

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
      Vue,
      beforeSend(event) {
        // 一度出始めると大量に送信しつづける IPC error のSentry送信を削減する(quota対策)
        if (event.exception && event.exception.values) {
          const value = event.exception.values[0].value;
          if (value?.match(/Failed to make IPC call/)) {
            console.log(`skip send to Sentry(IPC): ${value}`, event);
            return null;
          }
        }
        return event;
      },
    },
    sentryVueInit,
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

// Initiates tooltips
Vue.directive('tooltip', tooltipDirective);

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

    // setup VueI18n plugin
    Vue.use(VueI18n);
    const i18nService: I18nService = I18nService.instance();
    await i18nService.load(); // load translations from a disk
    const notFoundKeys = new Set<string>();

    // load notFoundKeys from file
    if (!isProduction) {
      const keys: string[] = await ipcRenderer.invoke('loadI18nNotFoundKeys');
      keys.forEach((key) => notFoundKeys.add(key));
    }

    const i18n = new VueI18n({
      locale: i18nService.state.locale,
      fallbackLocale: i18nService.getFallbackLocale(),
      messages: i18nService.getLoadedDictionaries(),
      missing: ((locale: VueI18n.Locale, key: VueI18n.Path, vm: Vue, values: any[]): string => {
        if (values[0] && typeof values[0].fallback === 'string') {
          // Check if the key exists in the dictionary with a null value
          // If so, don't warn - null means "use the fallback value from OBS"
          const dictionaries = i18nService.getLoadedDictionaries();
          // Convert key path like "settings.Output['Streaming']['Preset']['ultrafast']"
          // to lodash-compatible path like "settings.Output.Streaming.Preset.ultrafast"
          const lodashPath = key.replace(/\['([^']+)'\]/g, '.$1');
          const value = get(dictionaries[locale], lodashPath);

          if (value === null) {
            // Key exists with null value - this is intentional, use fallback without warning
            return values[0].fallback;
          }

          if (!isProduction) {
            // beware: enable following line only when investigating around i18n keys!
            // this adds huge amount of lines to console.

            // console.warn(`i18n missing key - ${key}: ${values[0].fallback}`);
            if (!notFoundKeys.has(key)) {
              notFoundKeys.add(key);
              console.warn(`i18n missing key - ${key}: (フォールバックなし)`);
              if (process.env.NAIR_UPDATE_I18N_NOT_FOUND_KEYS) {
                ipcRenderer.invoke('appendI18nNotFoundKeys', key);
              }
            }
          }
          return values[0].fallback;
        }

        // 返すべきものがないときは何も返さずデフォルト動作に任せる
        // ref. https://github.com/kazupon/vue-i18n/blob/79e3bfe537d28b11a3119ff9ed0704e5dfa72cf3/src/index.js#L172-L188
      }) as any, // 型定義と実装が異なっているのでanyに飛ばす
      silentTranslationWarn: true,
    });

    I18nService.setVuei18nInstance(i18n);

    Settings.defaultLocale = i18nService.state.locale.split('-')[0];

    // create a root Vue component
    const windowId = Utils.getCurrentUrlParams().windowId;
    const vm = new Vue({
      el: '#app',
      i18n,
      store,
      render: (h) => {
        if (windowId === 'child') return h(ChildWindow);
        if (windowId === 'main') {
          const componentName = windowsService.state[windowId].componentName;
          return h(windowsService.components[componentName]);
        }
        return h(OneOffWindow);
      },
    });

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
