import { createSetupFunction } from 'util/test-setup';

const setup = createSetupFunction({
  injectee: {
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
    },
  },
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
jest.mock('../../../obs-api', () => ({
  NodeObs: {},
  Global: {
    laggedFrames: 0,
    totalFrames: 0,
  },
}));

beforeEach(() => {
  jest.resetModules();
});

test('get instance', () => {
  setup(); // モックを設定
  const { PerformanceService } = require('./performance');
  expect(PerformanceService.instance()).toBeInstanceOf(PerformanceService);
});

test('getState returns proper state when pollingPerformanceStatistics is false', () => {
  const setupLocal = createSetupFunction({
    injectee: {
      CustomizationService: {
        pollingPerformanceStatistics: false, // false に設定
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
      },
    },
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
      injectee: {
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
            subscribe: subscribeMock,
          },
        },
      },
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
});

describe('Zero Bandwidth Alert', () => {
  function setupLiveStreaming() {
    const setupLocal = createSetupFunction({
      injectee: {
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
          state: { streamingStatus: 'live', streamingStatusTime: null },
        },
      },
    });
    setupLocal();

    const { PerformanceService } = require('./performance');
    const instance = PerformanceService.instance();
    // PerformanceService.init() は StatefulService.init() をオーバーライドしており、
    // mock 環境では state が自動初期化されないため明示的に設定する
    instance.state = PerformanceService.initialState;
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
