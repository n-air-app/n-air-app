import { I18nService } from 'services/i18n';

// eslint-disable-next-line
window['eval'] = global.eval = () => {
  throw new Error('window.eval() is disabled for security');
};

import 'reflect-metadata';
import Vue from 'vue';

import { createStore } from './store';
import { WindowsService } from './services/windows';
import { AppService } from './services/app';
import Utils from './services/utils';
import electron from 'electron';
import * as Sentry from '@sentry/electron/renderer';
import { init as sentryVueInit } from '@sentry/vue';
import VTooltip from 'v-tooltip';
import Toasted from 'vue-toasted';
import VueI18n from 'vue-i18n';
import moment from 'moment';
import { setupGlobalContextMenuForEditableElement } from 'util/menus/GlobalMenu';
import VModal from 'vue-js-modal';
import VeeValidate from 'vee-validate';
import ChildWindow from 'components/windows/ChildWindow.vue';
import OneOffWindow from 'components/windows/OneOffWindow.vue';
import util from 'util';
import * as obs from '../obs-api';
import uuid from 'uuid/v4';
import path from 'path';

const crashHandler = window['require']('crash-handler');

const { ipcRenderer, remote } = electron;

const nAirVersion = remote.process.env.NAIR_VERSION;
const isProduction = process.env.NODE_ENV === 'production';

type SentryParams = {
  organization: string;
  key: string;
  project: string;
};
const sentryOrg = 'o170115';

function getSentryCrashReportUrl(p: SentryParams): string {
  return `https://${p.organization}.ingest.sentry.io/api/${p.project}/minidump/?sentry_key=${p.key}`;
}

// This is the development DSN
let sentryParam: SentryParams = {
  organization: sentryOrg,
  project: '1262580',
  key: '1cb5cdf6a93c466dad570861b8c82b61',
};

if (isProduction) {
  // This is the production DSN
  sentryParam = Utils.isUnstable()
    ? { organization: sentryOrg, project: '5372801', key: '819e76e51864453aafd28c6d0473881f' } // crash-reporter-unstable
    : { organization: sentryOrg, project: '1520076', key: 'd965eea4b2254c2b9f38d2346fb8a472' }; // crash-reporter

  electron.crashReporter.start({
    productName: 'n-air-app',
    companyName: 'n-air-app',
    submitURL: getSentryCrashReportUrl(sentryParam),
    extra: {
      version: nAirVersion,
      processType: 'renderer',
    },
  });
}

const SENTRY_SERVER_URL = getSentryCrashReportUrl(sentryParam);

const windowId = Utils.getWindowId();

function wrapLogFn(fn: string) {
  const old: Function = console[fn];
  console[fn] = (...args: any[]) => {
    old.apply(console, args);

    const level = fn === 'log' ? 'info' : fn;

    sendLogMsg(level, ...args);
  };
}

function sendLogMsg(level: string, ...args: any[]) {
  const serialized = args
    .map(arg => {
      if (typeof arg === 'string') return arg;

      return util.inspect(arg);
    })
    .join(' ');

  ipcRenderer.send('logmsg', { level, sender: windowId, message: serialized });
}

['log', 'info', 'warn', 'error'].forEach(wrapLogFn);

window.addEventListener('error', e => {
  sendLogMsg('error', e.error);
});

window.addEventListener('unhandledrejection', e => {
  sendLogMsg('error', e.reason);
});

if ((isProduction || process.env.NAIR_REPORT_TO_SENTRY) && !electron.remote.process.env.NAIR_IPC) {
  Sentry.init(
    {
      sampleRate: /* isPreview ? */ 1.0 /* : 0.1 */,
      Vue,
      beforeSend(event) {
        // 一度出始めると大量に送信しつづける IPC error のSentry送信を削減する(quota対策)
        if (event.exception && event.exception.values) {
          const value = event.exception.values[0].value;
          if (value.match(/Failed to make IPC call/)) {
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

    Sentry.withScope(scope => {
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

// Initiates tooltips and sets their parent wrapper
Vue.use(VTooltip);
VTooltip.options.defaultContainer = '#mainWrapper';
Vue.use(Toasted);
Vue.use(VeeValidate); // form validations
Vue.use(VModal);

// Disable chrome default drag/drop behavior
document.addEventListener('dragover', event => event.preventDefault());
document.addEventListener('dragenter', event => event.preventDefault());
document.addEventListener('drop', event => event.preventDefault());
document.addEventListener('auxclick', event => event.preventDefault());

const locale = electron.remote.app.getLocale();

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
  electron.remote.dialog.showErrorBox(
    locale === 'ja' ? '初期化エラー' : 'Initialization Error',
    message,
  );
};

document.addEventListener('DOMContentLoaded', () => {
  createStore().then(async store => {
    const windowsService: WindowsService = WindowsService.instance;

    if (Utils.isMainWindow()) {
      // Services
      const appService: AppService = AppService.instance;

      // This is used for debugging
      window['obs'] = obs;

      // Host a new OBS server instance
      obs.IPC.host(`nair-${uuid()}`);
      obs.NodeObs.SetWorkingDirectory(
        path.join(
          electron.remote.app.getAppPath().replace('app.asar', 'app.asar.unpacked'),
          'node_modules',
          'obs-studio-node',
        ),
      );

      crashHandler.registerProcess(appService.pid, false);

      // await this.obsUserPluginsService.initialize();

      // Initialize OBS API
      const apiResult = obs.NodeObs.OBS_API_initAPI(
        'en-US',
        appService.appDataDirectory,
        electron.remote.process.env.NAIR_VERSION,
        SENTRY_SERVER_URL,
      );

      if (apiResult !== obs.EVideoCodes.Success) {
        const message = apiInitErrorResultToMessage(apiResult);
        showDialog(message);

        crashHandler.unregisterProcess(appService.pid);

        obs.NodeObs.InitShutdownSequence();
        obs.IPC.disconnect();

        electron.ipcRenderer.send('shutdownComplete');
        return;
      }

      ipcRenderer.on('closeWindow', () => windowsService.closeMainWindow());
      AppService.instance.load();
    } else {
      if (Utils.isChildWindow()) {
        ipcRenderer.on('closeWindow', () => windowsService.closeChildWindow());
      }
    }

    // setup VueI18n plugin
    Vue.use(VueI18n);
    const i18nService: I18nService = I18nService.instance;
    await i18nService.load(); // load translations from a disk
    const notFoundKeys = new Set<string>();

    const i18n = new VueI18n({
      locale: i18nService.state.locale,
      fallbackLocale: i18nService.getFallbackLocale(),
      messages: i18nService.getLoadedDictionaries(),
      missing: ((locale: VueI18n.Locale, key: VueI18n.Path, vm: Vue, values: any[]): string => {
        if (values[0] && typeof values[0].fallback === 'string') {
          if (!isProduction) {
            // beware: enable following line only when investigating around i18n keys!
            // this adds huge amount of lines to console.

            // console.warn(`i18n missing key - ${key}: ${values[0].fallback}`);
            if (!notFoundKeys.has(key)) {
              notFoundKeys.add(key);
              console.warn(`i18n missing key - ${key}: (フォールバックなし)`);
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

    const momentLocale = i18nService.state.locale.split('-')[0];
    moment.locale(momentLocale);

    // create a root Vue component
    const windowId = Utils.getCurrentUrlParams().windowId;
    const vm = new Vue({
      el: '#app',
      i18n,
      store,
      render: h => {
        if (windowId === 'child') return h(ChildWindow);
        if (windowId === 'main') {
          const componentName = windowsService.state[windowId].componentName;
          return h(windowsService.components[componentName]);
        }
        return h(OneOffWindow);
      },
    });

    Sentry.configureScope(scope => {
      scope.setTag('windowId', windowId);
    });

    setupGlobalContextMenuForEditableElement();
  });
});

if (Utils.isDevMode()) {
  window.addEventListener('error', () => ipcRenderer.send('showErrorAlert'));
  window.addEventListener('keyup', ev => {
    if (ev.key === 'F12') electron.ipcRenderer.send('openDevTools');
  });
}
