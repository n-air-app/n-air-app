import { createSetupFunction } from 'util/test-setup';

function makeInjectee(over: any = {}) {
  return {
    CustomizationService: {
      pollingPerformanceStatistics: true,
    },
    VideoSettingsService: {
      contexts: {
        horizontal: {
          skippedFrames: 0,
          encodedFrames: 0,
        },
      },
    },
    StreamingService: {
      streamingStatusChange: {
        subscribe: jest.fn(),
      },
      state: { streamingStatus: 'offline', streamingStatusTime: null },
    },
    ObsIpcHealthService: {
      notifyIpcLost: jest.fn(),
      isLost: false,
      ipcLost: { subscribe: jest.fn() },
    },
    ...over,
  };
}

const setup = createSetupFunction({
  injectee: makeInjectee(),
});

jest.mock('services/core/stateful-service');
jest.mock('services/core/injector');
jest.mock('services/settings', () => ({}));
jest.mock('services/customization', () => ({}));
jest.mock('services/streaming', () => ({
  EStreamingState: {
    Offline: 'offline',
    Starting: 'starting',
    Live: 'live',
    Ending: 'ending',
    Reconnecting: 'reconnecting',
  },
}));
jest.mock('services/settings-v2/video', () => ({}));
jest.mock('services/obs-ipc-health', () => ({}));
jest.mock('util/obs-ipc-error', () => ({
  isObsBackendIpcLost: jest.fn(() => false),
}));
jest.mock('../../../obs-api', () => ({
  NodeObs: {},
  Global: {
    laggedFrames: 0,
    totalFrames: 0,
  },
}));

beforeEach(() => {
  jest.resetModules();
  jest.spyOn(window, 'setInterval').mockImplementation(() => 0 as any);
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('get instance', () => {
  setup(); // モックを設定
  const { PerformanceService } = require('./performance');
  expect(PerformanceService.instance()).toBeInstanceOf(PerformanceService);
});

test('getState returns proper state when pollingPerformanceStatistics is false', () => {
  const setupLocal = createSetupFunction({
    injectee: makeInjectee({
      CustomizationService: {
        pollingPerformanceStatistics: false, // false に設定
      },
    }),
  });
  setupLocal();

  const { PerformanceService } = require('./performance');
  const instance = PerformanceService.instance();

  // getState() を呼ぶとゼロ値の状態が返される
  const state = instance.getState();
  expect(state.CPU).toBe(0);
  expect(state.numberDroppedFrames).toBe(0);
  expect(state.streamQuality).toBe('GOOD');
});

describe('Moving Average Calculation', () => {
  test('adds samples to historical records', () => {
    setup();
    const { PerformanceService } = require('./performance');
    const instance = PerformanceService.instance();

    instance.addSample(instance.historicalDroppedFrames, 0.1);
    instance.addSample(instance.historicalDroppedFrames, 0.2);
    instance.addSample(instance.historicalDroppedFrames, 0.3);

    expect(instance.historicalDroppedFrames).toEqual([0.1, 0.2, 0.3]);
  });

  test('calculates average factor correctly', () => {
    setup();
    const { PerformanceService } = require('./performance');
    const instance = PerformanceService.instance();

    const result = instance.averageFactor([0.1, 0.2, 0.3]);
    expect(result).toBeCloseTo(0.2);
  });

  test('maintains maximum 60 samples', () => {
    setup();
    const { PerformanceService } = require('./performance');
    const instance = PerformanceService.instance();

    // 61サンプルを追加
    for (let i = 0; i < 61; i++) {
      instance.addSample(instance.historicalDroppedFrames, i / 100);
    }

    // 最大60サンプルまでしか保持しない
    expect(instance.historicalDroppedFrames.length).toBe(60);
    // 最初のサンプル(0)は削除され、最後の60サンプルが残る
    expect(instance.historicalDroppedFrames[0]).toBeCloseTo(0.01);
    expect(instance.historicalDroppedFrames[59]).toBeCloseTo(0.6);
  });

  test('returns 0 for empty array', () => {
    setup();
    const { PerformanceService } = require('./performance');
    const instance = PerformanceService.instance();

    const result = instance.averageFactor([]);
    expect(result).toBe(0);
  });
});

describe('Stream Quality Detection', () => {
  test('returns GOOD when all factors below 0.05', () => {
    setup();
    const { PerformanceService } = require('./performance');
    const instance = PerformanceService.instance();

    instance.historicalDroppedFrames = [0.01, 0.02, 0.03];
    instance.historicalLaggedFrames = [0.02, 0.03, 0.04];
    instance.historicalSkippedFrames = [0.01, 0.01, 0.02];

    const quality = instance.calculateStreamQuality();
    expect(quality).toBe('GOOD');
  });

  test('returns FAIR when max factor between 0.05 and 0.15', () => {
    setup();
    const { PerformanceService } = require('./performance');
    const instance = PerformanceService.instance();

    instance.historicalDroppedFrames = [0.06, 0.07, 0.08];
    instance.historicalLaggedFrames = [0.02, 0.03, 0.04];
    instance.historicalSkippedFrames = [0.01, 0.01, 0.02];

    const quality = instance.calculateStreamQuality();
    expect(quality).toBe('FAIR');
  });

  test('returns POOR when max factor above 0.15', () => {
    setup();
    const { PerformanceService } = require('./performance');
    const instance = PerformanceService.instance();

    instance.historicalDroppedFrames = [0.16, 0.17, 0.18];
    instance.historicalLaggedFrames = [0.02, 0.03, 0.04];
    instance.historicalSkippedFrames = [0.01, 0.01, 0.02];

    const quality = instance.calculateStreamQuality();
    expect(quality).toBe('POOR');
  });

  test('returns GOOD when all arrays are empty', () => {
    setup();
    const { PerformanceService } = require('./performance');
    const instance = PerformanceService.instance();

    instance.historicalDroppedFrames = [];
    instance.historicalLaggedFrames = [];
    instance.historicalSkippedFrames = [];

    const quality = instance.calculateStreamQuality();
    expect(quality).toBe('GOOD');
  });
});

describe('Init and Streaming State', () => {
  test('init sets up interval', () => {
    setup();
    const { PerformanceService } = require('./performance');
    const instance = PerformanceService.instance();

    // init() が自動的に呼ばれているので、intervalId が設定されているはず
    expect(instance.intervalId).toBeDefined();
    expect(typeof instance.intervalId).toBe('number');
  });

  test('streamingStatusChange subscription resets historical data', () => {
    const subscribeMock = jest.fn();
    const setupWithMock = createSetupFunction({
      injectee: makeInjectee({
        StreamingService: {
          streamingStatusChange: {
            subscribe: subscribeMock,
          },
        },
      }),
    });
    setupWithMock();

    const { PerformanceService } = require('./performance');
    const instance = PerformanceService.instance();

    // subscribe が呼ばれていることを確認
    expect(subscribeMock).toHaveBeenCalled();

    // コールバックを取得
    const callback = subscribeMock.mock.calls[0][0];

    // 履歴にデータを追加
    instance.historicalDroppedFrames = [0.1, 0.2, 0.3];
    instance.historicalLaggedFrames = [0.1, 0.2, 0.3];
    instance.historicalSkippedFrames = [0.1, 0.2, 0.3];

    // Live 状態のコールバックを実行（EStreamingState.Live の値は 'live' という文字列）
    callback('live');

    // 履歴がリセットされていることを確認
    expect(instance.historicalDroppedFrames).toEqual([]);
    expect(instance.historicalLaggedFrames).toEqual([]);
    expect(instance.historicalSkippedFrames).toEqual([]);
  });

  test('init() で ipcLost を subscribe し、通知を受けるとポーリングと購読を停止する', () => {
    const unsubscribe = jest.fn();
    const ipcLostSubscribe = jest.fn((_callback: () => void) => ({ unsubscribe }));
    const setupWithMock = createSetupFunction({
      injectee: makeInjectee({
        ObsIpcHealthService: {
          notifyIpcLost: jest.fn(),
          isLost: false,
          ipcLost: { subscribe: ipcLostSubscribe },
        },
      }),
    });
    setupWithMock();

    const { PerformanceService } = require('./performance');
    const instance = PerformanceService.instance();

    expect(ipcLostSubscribe).toHaveBeenCalled();
    const clearIntervalSpy = jest.spyOn(window, 'clearInterval');
    const intervalIdBefore = instance.intervalId;

    const ipcLostCallback = ipcLostSubscribe.mock.calls[0][0];
    ipcLostCallback();

    expect(clearIntervalSpy).toHaveBeenCalledWith(intervalIdBefore);
    expect(unsubscribe).toHaveBeenCalled();
    clearIntervalSpy.mockRestore();
  });
});

describe('Zero Bandwidth Alert', () => {
  function setupLiveStreaming() {
    const setupLocal = createSetupFunction({
      injectee: makeInjectee({
        StreamingService: {
          streamingStatusChange: {
            subscribe: jest.fn(),
          },
          state: { streamingStatus: 'live', streamingStatusTime: null },
        },
      }),
    });
    setupLocal();

    const { PerformanceService } = require('./performance');
    const instance = PerformanceService.instance();
    // PerformanceService.init() は StatefulService.init() をオーバーライドしており、
    // mock 環境では state が自動初期化されないため明示的に設定する
    // (SET_PERFORMANCE_STATS が破壊的更新するため initialState 自体ではなくコピーを渡す)
    instance.state = { ...PerformanceService.initialState };
    const obs = require('../../../obs-api');
    obs.NodeObs.OBS_API_getPerformanceStatistics = jest.fn(() => ({
      CPU: 0,
      numberDroppedFrames: 0,
      percentageDroppedFrames: 0,
      streamingBandwidth: 0,
      frameRate: 0,
    }));
    return instance;
  }

  test('ZERO_BANDWIDTH_THRESHOLD は 30 秒相当 (15 サンプル) に設定されている', () => {
    setup();
    const { PerformanceService } = require('./performance');
    const instance = PerformanceService.instance();
    expect(instance.ZERO_BANDWIDTH_THRESHOLD).toBe(15);
  });

  test('閾値未達では streaming bandwidth stuck アラートを送信しない', () => {
    const instance = setupLiveStreaming();
    const { SentryReport } = require('util/sentry-report');
    const messageSpy = jest.spyOn(SentryReport, 'message');

    for (let i = 0; i < instance.ZERO_BANDWIDTH_THRESHOLD - 1; i++) {
      instance.update();
    }

    expect(messageSpy).not.toHaveBeenCalledWith(
      'PerformanceService',
      'update',
      'streaming bandwidth stuck at 0kbps',
      expect.anything(),
    );
  });

  test('閾値到達で streaming bandwidth stuck アラートを1回だけ送信する', () => {
    const instance = setupLiveStreaming();
    const { SentryReport } = require('util/sentry-report');
    const messageSpy = jest.spyOn(SentryReport, 'message');

    for (let i = 0; i < instance.ZERO_BANDWIDTH_THRESHOLD + 5; i++) {
      instance.update();
    }

    const bandwidthCalls = messageSpy.mock.calls.filter(
      ([, , message]) => message === 'streaming bandwidth stuck at 0kbps',
    );
    expect(bandwidthCalls.length).toBe(1);
  });
});

describe('OBS バックエンド IPC 切断の検知', () => {
  function setupWithGetPerformanceStatistics(impl: () => any) {
    const obsIpcHealthService = {
      notifyIpcLost: jest.fn(),
      isLost: false,
      ipcLost: { subscribe: jest.fn() },
    };
    const setupLocal = createSetupFunction({
      injectee: makeInjectee({ ObsIpcHealthService: obsIpcHealthService }),
    });
    setupLocal();

    const { PerformanceService } = require('./performance');
    const instance = PerformanceService.instance();
    instance.state = { ...PerformanceService.initialState };
    const obs = require('../../../obs-api');
    obs.NodeObs.OBS_API_getPerformanceStatistics = jest.fn(impl);
    return { instance, obsIpcHealthService };
  }

  test('getState() が IPC 切断エラーで失敗すると notifyIpcLost が呼ばれる', () => {
    const { isObsBackendIpcLost } = require('util/obs-ipc-error');
    (isObsBackendIpcLost as jest.Mock).mockReturnValue(true);
    const { instance, obsIpcHealthService } = setupWithGetPerformanceStatistics(() => {
      throw new Error('Failed to make IPC call, verify IPC status.');
    });

    const result = instance.getState();

    expect(result).toBeNull();
    expect(obsIpcHealthService.notifyIpcLost).toHaveBeenCalledWith('PerformanceService.getState');
  });

  test('getState() が IPC 切断以外のエラーで失敗した場合は notifyIpcLost を呼ばず従来の SentryReport.error を送る', () => {
    const { isObsBackendIpcLost } = require('util/obs-ipc-error');
    (isObsBackendIpcLost as jest.Mock).mockReturnValue(false);
    const { instance, obsIpcHealthService } = setupWithGetPerformanceStatistics(() => {
      throw new Error('some other error');
    });
    const { SentryReport } = require('util/sentry-report');
    const errorSpy = jest.spyOn(SentryReport, 'error');

    const result = instance.getState();

    expect(result).toBeNull();
    expect(obsIpcHealthService.notifyIpcLost).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith('PerformanceService', 'getState', expect.anything(), expect.anything());
  });

  test('IPC 切断時は SentryReport.error を送らない（ObsIpcHealthService が1度だけ報告する）', () => {
    const { isObsBackendIpcLost } = require('util/obs-ipc-error');
    (isObsBackendIpcLost as jest.Mock).mockReturnValue(true);
    const { instance } = setupWithGetPerformanceStatistics(() => {
      throw new Error('Failed to make IPC call, verify IPC status.');
    });
    const { SentryReport } = require('util/sentry-report');
    const errorSpy = jest.spyOn(SentryReport, 'error');

    instance.getState();

    expect(errorSpy).not.toHaveBeenCalled();
  });
});

describe('readFrameStats', () => {
  function setupForFrameStats(over: any = {}) {
    const obsIpcHealthService = {
      notifyIpcLost: jest.fn(),
      isLost: false,
      ipcLost: { subscribe: jest.fn() },
    };
    const setupLocal = createSetupFunction({
      injectee: makeInjectee({ ObsIpcHealthService: obsIpcHealthService, ...over }),
    });
    setupLocal();

    const { PerformanceService } = require('./performance');
    const instance = PerformanceService.instance();
    instance.state = { ...PerformanceService.initialState };
    const obs = require('../../../obs-api');
    obs.NodeObs.OBS_API_getPerformanceStatistics = jest.fn(() => ({
      CPU: 0,
      numberDroppedFrames: 0,
      percentageDroppedFrames: 0,
      streamingBandwidth: 0,
      frameRate: 0,
    }));
    return { instance, obsIpcHealthService, obs };
  }

  test('obs.Global.laggedFrames が throw しても update() は例外を投げない', () => {
    const { isObsBackendIpcLost } = require('util/obs-ipc-error');
    (isObsBackendIpcLost as jest.Mock).mockReturnValue(false);
    const { instance, obs } = setupForFrameStats();
    Object.defineProperty(obs.Global, 'laggedFrames', {
      get() {
        throw new Error('boom');
      },
      configurable: true,
    });

    expect(() => instance.update()).not.toThrow();

    // 後続のテストに影響しないよう元に戻す
    Object.defineProperty(obs.Global, 'laggedFrames', { value: 0, configurable: true });
  });

  test('obs.Global.laggedFrames が IPC 切断で throw すると notifyIpcLost が呼ばれる', () => {
    const { isObsBackendIpcLost } = require('util/obs-ipc-error');
    (isObsBackendIpcLost as jest.Mock).mockReturnValue(true);
    const { instance, obsIpcHealthService, obs } = setupForFrameStats();
    Object.defineProperty(obs.Global, 'laggedFrames', {
      get() {
        throw new Error('Failed to make IPC call, verify IPC status.');
      },
      configurable: true,
    });

    instance.update();

    expect(obsIpcHealthService.notifyIpcLost).toHaveBeenCalledWith('PerformanceService.readFrameStats');

    Object.defineProperty(obs.Global, 'laggedFrames', { value: 0, configurable: true });
  });

  test('フレーム統計取得に失敗しても前回値を引き継いで CPU / 帯域の更新は継続する', () => {
    const { isObsBackendIpcLost } = require('util/obs-ipc-error');
    (isObsBackendIpcLost as jest.Mock).mockReturnValue(false);
    const { instance, obs } = setupForFrameStats();
    instance.state.numberLaggedFrames = 42;
    Object.defineProperty(obs.Global, 'laggedFrames', {
      get() {
        throw new Error('boom');
      },
      configurable: true,
    });

    instance.update();

    expect(instance.state.numberLaggedFrames).toBe(42);

    Object.defineProperty(obs.Global, 'laggedFrames', { value: 0, configurable: true });
  });

  test('videoSettingsService.contexts.horizontal が undefined でも 0 として扱う', () => {
    const { isObsBackendIpcLost } = require('util/obs-ipc-error');
    (isObsBackendIpcLost as jest.Mock).mockReturnValue(false);
    const { instance } = setupForFrameStats({
      VideoSettingsService: { contexts: { horizontal: undefined } },
    });

    expect(() => instance.update()).not.toThrow();
    expect(instance.state.numberSkippedFrames).toBe(0);
  });

  test('フレーム統計の失敗 Sentry 報告は連続失敗しても1回だけ', () => {
    const { isObsBackendIpcLost } = require('util/obs-ipc-error');
    (isObsBackendIpcLost as jest.Mock).mockReturnValue(false);
    const { instance, obs } = setupForFrameStats();
    const { SentryReport } = require('util/sentry-report');
    const errorSpy = jest.spyOn(SentryReport, 'error');
    Object.defineProperty(obs.Global, 'laggedFrames', {
      get() {
        throw new Error('boom');
      },
      configurable: true,
    });

    instance.update();
    instance.update();
    instance.update();

    const frameStatsCalls = errorSpy.mock.calls.filter(([, method]) => method === 'readFrameStats');
    expect(frameStatsCalls.length).toBe(1);

    Object.defineProperty(obs.Global, 'laggedFrames', { value: 0, configurable: true });
  });
});
