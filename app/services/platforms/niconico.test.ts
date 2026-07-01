import { jest_fn } from 'util/jest_fn';
import { createSetupFunction } from 'util/test-setup';

import { NiconicoService as NiconicoServiceType } from './niconico';

const setup = createSetupFunction({
  injectee: {
    HostsService: {},
    SettingsService: {},
    UserService: {},
    StreamingService: {
      streamingStatusChange: {
        subscribe() {},
      },
    },
    WindowsService: {},
  },
});

jest.mock('services/core/stateful-service');
jest.mock('services/core/injector');
jest.mock('services/streaming', () => ({}));
jest.mock('services/user', () => ({}));
jest.mock('services/settings', () => ({}));
jest.mock('services/windows', () => ({}));
jest.mock('services/i18n', () => ({
  $t: (x: any) => x,
}));
jest.mock('util/sleep', () => ({
  sleep: () => jest.requireActual('util/sleep').sleep(0),
}));
jest.mock('util/menus/Menu', () => ({}));
jest.mock('services/sources');
jest.mock('services/i18n', () => ({
  $t: (x: any) => x,
}));
jest.mock('@electron/remote', () => ({
  BrowserWindow: jest.fn(),
}));
jest.mock('@sentry/vue', () => ({
  addBreadcrumb: jest.fn(),
  withScope: jest.fn((_cb: (scope: any) => void) => _cb({ setLevel: jest.fn(), setTag: jest.fn(), setFingerprint: jest.fn(), setExtra: jest.fn(), setContext: jest.fn() })),
  captureMessage: jest.fn(),
  captureException: jest.fn(),
}));
jest.mock('util/sentry-report', () => ({
  SentryReport: {
    message: jest.fn(),
    error: jest.fn(),
  },
}));

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
});

function setupInstance() {
  const { NiconicoService } = require('./niconico');
  const instance = NiconicoService.instance() as NiconicoServiceType;

  instance.client.fetchIngestInfo = jest_fn<
    typeof instance.client.fetchIngestInfo
  >().mockImplementation((programId: string) =>
    Promise.resolve({
      ok: true,
      value: {
        rtmp: {
          tcUrl: 'url1',
          streamName: 'key1',
          appName: 'app1',
        },
        rtmps: {
          tcUrl: 'url2', // この値は使わない
          streamName: 'key2',
          appName: 'app2',
        },
      },
    }),
  );
  instance.client.fetchMaxQuality = jest_fn<
    typeof instance.client.fetchMaxQuality
  >().mockImplementation((programId: string) =>
    Promise.resolve({
      bitrate: 6000,
      height: 720,
      fps: 30,
    }),
  );
  return instance;
}

test('get instance', () => {
  setup();
  const { NiconicoService } = require('./niconico');
  expect(NiconicoService.instance()).toBeInstanceOf(NiconicoService);
});

test('setupStreamSettingsでストリーム情報がとれた場合', async () => {
  const updatePlatformChannelId = jest.fn();
  const getSettingsFormData = jest.fn();
  const setSettings = jest.fn();
  const showWindow = jest.fn();

  getSettingsFormData.mockReturnValue([
    {
      nameSubCategory: 'Untitled',
      parameters: [
        { name: 'service', value: '' },
        { name: 'server', value: '' },
        { name: 'key', value: '' },
      ],
    },
  ]);

  const injectee = {
    UserService: {
      updatePlatformChannelId,
    },
    SettingsService: {
      getSettingsFormData,
      setSettings,
    },
    WindowsService: {
      showWindow,
    },
  };

  setup({ injectee });
  const instance = setupInstance();

  const result = await instance.setupStreamSettings('lv12345');
  expect(result).toEqual({
    url: 'url1',
    key: 'key1',
    quality: {
      bitrate: 6000,
      height: 720,
      fps: 30,
    },
  });

  expect(setSettings).toHaveBeenCalledTimes(1);
  expect(setSettings.mock.calls[0]).toMatchSnapshot();
});

test('setupStreamSettingsで番組取得にリトライで成功する場合', async () => {
  const updatePlatformChannelId = jest.fn();
  const getSettingsFormData = jest.fn();
  const setSettings = jest.fn();

  getSettingsFormData.mockReturnValue([
    {
      nameSubCategory: 'Untitled',
      parameters: [
        { name: 'service', value: '' },
        { name: 'server', value: '' },
        { name: 'key', value: '' },
      ],
    },
  ]);

  const injectee = {
    UserService: { updatePlatformChannelId },
    SettingsService: { getSettingsFormData, setSettings },
  };

  setup({ injectee });
  const instance = setupInstance();

  const result = await instance.setupStreamSettings('');
  expect(result).toEqual({
    url: 'url1',
    key: 'key1',
    quality: {
      bitrate: 6000,
      height: 720,
      fps: 30,
    },
  });
  expect(setSettings).toHaveBeenCalledTimes(1);
  expect(setSettings.mock.calls[0]).toMatchSnapshot();
});

describe('setupStreamSettings 失敗時の診断報告', () => {
  function makeInjectee(overrides: { setSettings?: () => void } = {}) {
    const getSettingsFormData = jest.fn().mockReturnValue([
      {
        nameSubCategory: 'Untitled',
        parameters: [
          { name: 'service', value: '' },
          { name: 'server', value: '' },
          { name: 'key', value: '' },
        ],
      },
    ]);
    const setSettings = overrides.setSettings ?? jest.fn();
    return {
      UserService: {},
      SettingsService: { getSettingsFormData, setSettings },
    };
  }

  test('fetchIngestInfo が network_error で失敗した場合、SentryReport.message が step=fetchIngestInfo で呼ばれる', async () => {
    setup({ injectee: makeInjectee() });
    const { NiconicoService } = require('./niconico');
    const { SentryReport } = require('util/sentry-report');
    const instance = NiconicoService.instance() as NiconicoServiceType;

    // fetchIngestInfo を network_error で失敗させる
    instance.client.fetchIngestInfo = jest.fn().mockResolvedValue({
      ok: false,
      value: new Error('fetch failed'),
      diag: { route: 'main', failureKind: 'network_error' },
    });
    instance.client.fetchMaxQuality = jest.fn().mockResolvedValue({ bitrate: 192, height: 288, fps: 30 });

    const result = await instance.setupStreamSettings('lv12345');

    // emptyStreamingSetting (key='') が返る
    expect(result.key).toBe('');
    // lastSetupFailure に失敗が保持される
    expect(instance.lastSetupFailure).not.toBeNull();
    expect(instance.lastSetupFailure?.method).toBe('fetchIngestInfo');
    expect(instance.lastSetupFailure?.failureKind).toBe('network_error');
    expect(instance.lastSetupFailure?.route).toBe('main');

    // SentryReport.message が呼ばれ、step と failureKind が tags に含まれる
    expect(SentryReport.message).toHaveBeenCalled();
    const [, , message, opts] = (SentryReport.message as jest.Mock).mock.calls[0];
    expect(message).toContain('fetchIngestInfo');
    expect(message).toContain('network_error');
    expect(opts.tags['stream.setup.step']).toBe('fetchIngestInfo');
    expect(opts.tags['stream.setup.failureKind']).toBe('network_error');
    expect(opts.tags['stream.setup.route']).toBe('main');
    expect(opts.tags['diagnostic']).toBe('stream-setup');
    expect(opts.fingerprint).toContain('fetchIngestInfo');
    expect(opts.fingerprint).toContain('network_error');
  });

  test('fetchIngestInfo が http_error(503) で失敗した場合、fingerprint に httpStatus が含まれる', async () => {
    setup({ injectee: makeInjectee() });
    const { NiconicoService } = require('./niconico');
    const { SentryReport } = require('util/sentry-report');
    const instance = NiconicoService.instance() as NiconicoServiceType;

    instance.client.fetchIngestInfo = jest.fn().mockResolvedValue({
      ok: false,
      value: { meta: { status: 503, errorCode: 'SERVER_ERROR', errorMessage: 'server error' } },
      diag: { route: 'main', httpStatus: 503, failureKind: 'http_error' },
    });
    instance.client.fetchMaxQuality = jest.fn().mockResolvedValue({ bitrate: 192, height: 288, fps: 30 });

    await instance.setupStreamSettings('lv12345');

    expect(SentryReport.message).toHaveBeenCalled();
    const [, , , opts] = (SentryReport.message as jest.Mock).mock.calls[0];
    expect(opts.tags['stream.setup.step']).toBe('fetchIngestInfo');
    expect(opts.tags['stream.setup.failureKind']).toBe('http_error');
    expect(opts.tags['stream.setup.httpStatus']).toBe('503');
    // fingerprint が httpStatus で分割されている
    expect(opts.fingerprint).toContain('503');
  });

  test('setSettings が失敗した場合、step=setSettings の fingerprint で報告される', async () => {
    setup({
      injectee: makeInjectee({
        setSettings: jest.fn().mockImplementation(() => { throw new Error('Failed to save settings'); }),
      }),
    });
    const { NiconicoService } = require('./niconico');
    const { SentryReport } = require('util/sentry-report');
    const instance = NiconicoService.instance() as NiconicoServiceType;

    instance.client.fetchIngestInfo = jest.fn().mockResolvedValue({
      ok: true,
      value: {
        rtmp: { tcUrl: 'url1', streamName: 'key1', appName: 'app1' },
        rtmps: { tcUrl: 'url2', streamName: 'key2', appName: 'app2' },
      },
    });
    instance.client.fetchMaxQuality = jest.fn().mockResolvedValue({ bitrate: 192, height: 288, fps: 30 });

    const result = await instance.setupStreamSettings('lv12345');

    expect(result.key).toBe('');
    expect(instance.lastSetupFailure?.method).toBe('setSettings');

    expect(SentryReport.message).toHaveBeenCalled();
    const [, , message, opts] = (SentryReport.message as jest.Mock).mock.calls[0];
    expect(message).toContain('setSettings');
    expect(opts.tags['stream.setup.step']).toBe('setSettings');
    expect(opts.fingerprint).toContain('setSettings');
    // catchされる e は Error を継承しない NicoliveFailure なので、
    // String(e) の "[object Object]" ではなく元のnative例外メッセージが入ること
    expect(opts.extra.errorMessage).toContain('Failed to save settings');
    expect(opts.extra.errorMessage).not.toBe('[object Object]');
  });

  test('2回目失敗でのみSentryReport.messageが呼ばれ、1回目(リトライ前)は呼ばれない', async () => {
    const getSettingsFormData = jest.fn().mockReturnValue([
      {
        nameSubCategory: 'Untitled',
        parameters: [
          { name: 'service', value: '' },
          { name: 'server', value: '' },
          { name: 'key', value: '' },
        ],
      },
    ]);
    setup({ injectee: { UserService: {}, SettingsService: { getSettingsFormData, setSettings: jest.fn() } } });

    const { NiconicoService } = require('./niconico');
    const { SentryReport } = require('util/sentry-report');
    const instance = NiconicoService.instance() as NiconicoServiceType;

    let callCount = 0;
    instance.client.fetchIngestInfo = jest.fn().mockImplementation(() => {
      callCount++;
      return Promise.resolve({ ok: false, value: new Error('fail'), diag: { route: 'main', failureKind: 'network_error' } });
    });
    instance.client.fetchMaxQuality = jest.fn().mockResolvedValue({ bitrate: 192, height: 288, fps: 30 });

    await instance.setupStreamSettings('lv12345');

    // fetchIngestInfo が 2 回呼ばれている（リトライあり）
    expect(callCount).toBe(2);
    // SentryReport.message は 1 回だけ（2回目失敗時のみ）
    expect((SentryReport.message as jest.Mock).mock.calls.length).toBe(1);
  });

  test('同一ステップで SETUP_REPORT_MAX_PER_KEY(5) 回を超えたときはSentryReport.messageが抑制される', async () => {
    const getSettingsFormData = jest.fn().mockReturnValue([
      { nameSubCategory: 'Untitled', parameters: [{ name: 'service', value: '' }, { name: 'server', value: '' }, { name: 'key', value: '' }] },
    ]);
    setup({ injectee: { UserService: {}, SettingsService: { getSettingsFormData, setSettings: jest.fn() } } });

    const { NiconicoService } = require('./niconico');
    const { SentryReport } = require('util/sentry-report');
    const instance = NiconicoService.instance() as NiconicoServiceType;

    instance.client.fetchIngestInfo = jest.fn().mockResolvedValue({
      ok: false, value: new Error('fail'), diag: { route: 'renderer', failureKind: 'network_error' },
    });
    instance.client.fetchMaxQuality = jest.fn().mockResolvedValue({ bitrate: 192, height: 288, fps: 30 });

    // NiconicoService.setupReportState をリセット（静的フィールド）
    (NiconicoService as any).setupReportState.clear();

    // fake-timers で Date.now() を制御し、60秒窓ガードを回避して5件上限を確認する
    const FakeTimers = require('@sinonjs/fake-timers');
    const clock = FakeTimers.install({ now: 0, toFake: ['Date'] });
    try {
      for (let i = 0; i < 7; i++) {
        // 各回で60秒以上進めて窓ガードをリセットし、件数上限(5件)だけを検証する
        clock.tick(61_000);
        await instance.setupStreamSettings('lv12345');
      }
    } finally {
      clock.uninstall();
    }

    // quota ガードにより 5 回だけ送信される
    expect((SentryReport.message as jest.Mock).mock.calls.length).toBe(5);
    // 5 回目の呼び出しに reportCapReached が付く
    const fifthCall = (SentryReport.message as jest.Mock).mock.calls[4];
    expect(fifthCall[3].extra?.reportCapReached).toBe(true);
  });
});
