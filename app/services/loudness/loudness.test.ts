import * as FakeTimers from '@sinonjs/fake-timers';
import { createSetupFunction } from 'util/test-setup';

import type { ILoudness, LoudnessService, LoudnessStatus } from './loudness';

const mockCallEx = jest.fn();
const mockClose = jest.fn();

jest.mock('services/substream/NamedPipeClient', () => ({
  NamedPipeClient: jest.fn().mockImplementation(() => ({
    callEx: (...args: unknown[]) => mockCallEx(...args),
    close: () => mockClose(),
  })),
}));

const mockCaptureException = jest.fn();
jest.mock('@sentry/vue', () => ({
  withScope: (cb: (scope: { setFingerprint: jest.Mock }) => void) => cb({ setFingerprint: jest.fn() }),
  captureException: (...args: unknown[]) => mockCaptureException(...args),
}));

jest.mock('services/settings', () => ({}));

type OutputState = { Mode?: string; TrackIndex?: number | string };

function makeSetup(output: OutputState) {
  return createSetupFunction({
    state: {
      LoudnessService: { targetLufs: -15 },
    },
    injectee: {
      SettingsService: { state: { Output: output } },
    },
  });
}

let clock: FakeTimers.Clock;

beforeEach(() => {
  jest.doMock('services/core/stateful-service');
  jest.doMock('services/core/injector');
  clock = FakeTimers.install();
  mockCallEx.mockReset();
  mockClose.mockReset();
  mockCaptureException.mockReset();
});

afterEach(() => {
  clock.uninstall();
  jest.resetModules();
});

function getService(output: OutputState = { Mode: 'Simple' }): LoudnessService {
  makeSetup(output)();
  const { LoudnessService } = require('./loudness');
  return LoudnessService.instance() as LoudnessService;
}

// プラグインの振る舞いを模した callEx。fn ごとに応答を返す
function fakePlugin(get: () => Partial<ILoudness> & { error?: string } = () => ({})) {
  let nextId = 1;
  mockCallEx.mockImplementation(async (fn: string) => {
    switch (fn) {
      case 'destroyAll':
      case 'destroy':
      case 'reset':
        return { result: 'OK' };
      case 'create':
        return { meterId: nextId++ };
      case 'get':
        return get();
      default:
        return { error: `unknown function: ${fn}` };
    }
  });
}

function callsOf(fn: string) {
  return mockCallEx.mock.calls.filter(([name]) => name === fn);
}

async function flush() {
  // lifecycle の Promise チェーンを進める
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

describe('getStreamingTrack', () => {
  test.each<[OutputState, number]>([
    [{ Mode: 'Simple', TrackIndex: 3 }, 0],
    [{ Mode: 'Advanced', TrackIndex: 1 }, 0],
    [{ Mode: 'Advanced', TrackIndex: 3 }, 2],
    [{ Mode: 'Advanced', TrackIndex: '2' }, 1],
    [{ Mode: 'Advanced' }, 0],
    [{ Mode: 'Advanced', TrackIndex: 0 }, 0],
    [{}, 0],
  ])('%j => %d', (output, expected) => {
    expect(getService(output).getStreamingTrack()).toBe(expected);
  });
});

describe('enable / disable', () => {
  test('enable で配信トラックのメーターを作り、定期的に値を取得する', async () => {
    fakePlugin(() => ({ momentary: -20, shortTerm: -18.5, integrated: -19, range: 3 }));
    const service = getService({ Mode: 'Advanced', TrackIndex: 2 });
    const values: ILoudness[] = [];
    service.loudness.subscribe((v) => values.push(v));
    const statuses: LoudnessStatus[] = [];
    service.status.subscribe((s) => statuses.push(s));

    service.enable();
    await flush();

    expect(callsOf('destroyAll')).toHaveLength(1);
    expect(callsOf('create')).toEqual([['create', { type: 'track', track: 1 }]]);
    expect(statuses.at(-1)).toBe('running');

    await clock.tickAsync(200);
    await flush();

    expect(callsOf('get')).toEqual([['get', { meterId: 1 }]]);
    expect(values.at(-1)).toEqual({ momentary: -20, shortTerm: -18.5, integrated: -19, range: 3 });

    await clock.tickAsync(200);
    await flush();
    expect(callsOf('get')).toHaveLength(2);
  });

  test('未確定の値は null のまま渡す', async () => {
    fakePlugin(() => ({ momentary: -30, shortTerm: null, integrated: null, range: null }));
    const service = getService();
    const values: ILoudness[] = [];
    service.loudness.subscribe((v) => values.push(v));

    service.enable();
    await flush();
    await clock.tickAsync(200);
    await flush();

    expect(values.at(-1)).toEqual({ momentary: -30, shortTerm: null, integrated: null, range: null });
  });

  test('ネストした enable は最後の disable で止まる', async () => {
    fakePlugin();
    const service = getService();

    service.enable();
    service.enable();
    await flush();
    expect(callsOf('create')).toHaveLength(1);

    service.disable();
    await flush();
    expect(callsOf('destroy')).toHaveLength(0);

    service.disable();
    await flush();
    expect(callsOf('destroy')).toEqual([['destroy', { meterId: 1 }]]);
    expect(mockClose).toHaveBeenCalled();

    // 止まった後はポーリングしない
    const getCount = callsOf('get').length;
    await clock.tickAsync(1000);
    await flush();
    expect(callsOf('get')).toHaveLength(getCount);
  });

  test('disable を enable より多く呼んでもカウンタが負にならない', async () => {
    fakePlugin();
    const service = getService();

    service.disable();
    service.enable();
    await flush();

    expect(callsOf('create')).toHaveLength(1);
  });

  test('配信トラックが変わったらメーターを作り直す', async () => {
    fakePlugin();
    const service = getService({ Mode: 'Simple' });

    service.enable();
    await flush();
    expect(callsOf('create')).toEqual([['create', { type: 'track', track: 0 }]]);

    // createSetupFunction は injectee をコピーするので、サービスが参照している方を書き換える
    const output = (service as any).settingsService.state.Output as OutputState;
    output.Mode = 'Advanced';
    output.TrackIndex = 3;
    await clock.tickAsync(200);
    await flush();

    expect(callsOf('destroy')).toEqual([['destroy', { meterId: 1 }]]);
    expect(callsOf('create').at(-1)).toEqual(['create', { type: 'track', track: 2 }]);
    expect(callsOf('get').at(-1)).toEqual(['get', { meterId: 2 }]);
  });
});

describe('プラグインが使えないとき', () => {
  test('接続できなければ unavailable にして Sentry に1回だけ送る', async () => {
    mockCallEx.mockRejectedValue(new Error('connect ENOENT'));
    const service = getService();
    const statuses: LoudnessStatus[] = [];
    service.status.subscribe((s) => statuses.push(s));

    service.enable();
    await flush();

    expect(statuses.at(-1)).toBe('unavailable');
    expect(mockCaptureException).toHaveBeenCalledTimes(1);

    // 再度 enable しても重複して送らない
    service.disable();
    service.enable();
    await flush();
    expect(mockCaptureException).toHaveBeenCalledTimes(1);
    expect(statuses.at(-1)).toBe('unavailable');
  });

  test('ポーリング中にエラーが返ったらポーリングを止める', async () => {
    fakePlugin(() => ({ error: 'meter not found' }));
    const service = getService();
    const statuses: LoudnessStatus[] = [];
    service.status.subscribe((s) => statuses.push(s));

    service.enable();
    await flush();
    await clock.tickAsync(200);
    await flush();

    expect(statuses.at(-1)).toBe('unavailable');
    expect(mockCaptureException).toHaveBeenCalledTimes(1);

    const getCount = callsOf('get').length;
    await clock.tickAsync(1000);
    await flush();
    expect(callsOf('get')).toHaveLength(getCount);
  });
});

describe('reset', () => {
  test('計測中のメーターをリセットする', async () => {
    fakePlugin();
    const service = getService();

    service.enable();
    await flush();
    service.reset();
    await flush();

    expect(callsOf('reset')).toEqual([['reset', { meterId: 1 }]]);
  });

  test('計測していなければ何もしない', async () => {
    fakePlugin();
    const service = getService();

    service.reset();
    await flush();

    expect(callsOf('reset')).toHaveLength(0);
  });
});

describe('targetLufs', () => {
  test('初期値は -15', () => {
    expect(getService().targetLufs).toBe(-15);
  });

  test('有限値だけ受け付ける', () => {
    const service = getService();
    service.setTargetLufs(-14);
    expect(service.targetLufs).toBe(-14);
    service.setTargetLufs(NaN);
    expect(service.targetLufs).toBe(-14);
  });
});
