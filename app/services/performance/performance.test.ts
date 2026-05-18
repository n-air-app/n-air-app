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
  expect(PerformanceService.instance).toBeInstanceOf(PerformanceService);
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
  const { instance } = PerformanceService;

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
    const { instance } = PerformanceService;

    instance.addSample(instance.historicalDroppedFrames, 0.1);
    instance.addSample(instance.historicalDroppedFrames, 0.2);
    instance.addSample(instance.historicalDroppedFrames, 0.3);

    expect(instance.historicalDroppedFrames).toEqual([0.1, 0.2, 0.3]);
  });

  test('calculates average factor correctly', () => {
    setup();
    const { PerformanceService } = require('./performance');
    const { instance } = PerformanceService;

    const result = instance.averageFactor([0.1, 0.2, 0.3]);
    expect(result).toBeCloseTo(0.2);
  });

  test('maintains maximum 60 samples', () => {
    setup();
    const { PerformanceService } = require('./performance');
    const { instance } = PerformanceService;

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
    const { instance } = PerformanceService;

    const result = instance.averageFactor([]);
    expect(result).toBe(0);
  });
});

describe('Stream Quality Detection', () => {
  test('returns GOOD when all factors below 0.05', () => {
    setup();
    const { PerformanceService } = require('./performance');
    const { instance } = PerformanceService;

    instance.historicalDroppedFrames = [0.01, 0.02, 0.03];
    instance.historicalLaggedFrames = [0.02, 0.03, 0.04];
    instance.historicalSkippedFrames = [0.01, 0.01, 0.02];

    const quality = instance.calculateStreamQuality();
    expect(quality).toBe('GOOD');
  });

  test('returns FAIR when max factor between 0.05 and 0.15', () => {
    setup();
    const { PerformanceService } = require('./performance');
    const { instance } = PerformanceService;

    instance.historicalDroppedFrames = [0.06, 0.07, 0.08];
    instance.historicalLaggedFrames = [0.02, 0.03, 0.04];
    instance.historicalSkippedFrames = [0.01, 0.01, 0.02];

    const quality = instance.calculateStreamQuality();
    expect(quality).toBe('FAIR');
  });

  test('returns POOR when max factor above 0.15', () => {
    setup();
    const { PerformanceService } = require('./performance');
    const { instance } = PerformanceService;

    instance.historicalDroppedFrames = [0.16, 0.17, 0.18];
    instance.historicalLaggedFrames = [0.02, 0.03, 0.04];
    instance.historicalSkippedFrames = [0.01, 0.01, 0.02];

    const quality = instance.calculateStreamQuality();
    expect(quality).toBe('POOR');
  });

  test('returns GOOD when all arrays are empty', () => {
    setup();
    const { PerformanceService } = require('./performance');
    const { instance } = PerformanceService;

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
    const { instance } = PerformanceService;

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
    const { instance } = PerformanceService;

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
