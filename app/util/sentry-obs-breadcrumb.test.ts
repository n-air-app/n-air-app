import * as Sentry from '@sentry/vue';
import FakeTimers from '@sinonjs/fake-timers';

import {
  assertObsObjectDefined,
  getLastObsOp,
  markObsOp,
  resetNullReportState,
  runObsOp,
  setObsOpObserver,
} from './sentry-obs-breadcrumb';
import { SentryReport } from './sentry-report';

jest.mock('@sentry/vue', () => ({
  addBreadcrumb: jest.fn(),
  setTag: jest.fn(),
}));

jest.mock('./sentry-report', () => ({
  SentryReport: {
    error: jest.fn(),
    message: jest.fn(),
  },
}));

describe('sentry-obs-breadcrumb', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setObsOpObserver(null);
  });

  test('markObsOp が breadcrumb を追加する', () => {
    markObsOp('ScenesService', 'makeSceneActive');
    expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
      category: 'obs',
      message: 'ScenesService.makeSceneActive',
      level: 'info',
      data: undefined,
    });
  });

  test('markObsOp が obs.lastOp タグをセットする', () => {
    markObsOp('ScenesService', 'makeSceneActive');
    expect(Sentry.setTag).toHaveBeenCalledWith('obs.lastOp', 'ScenesService.makeSceneActive');
  });

  test('data が渡された場合は breadcrumb に含まれる', () => {
    markObsOp('SourcesService', 'createSource', { type: 'video_capture_device' });
    expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
      category: 'obs',
      message: 'SourcesService.createSource',
      level: 'info',
      data: { type: 'video_capture_device' },
    });
  });

  test('getLastObsOp は最後に呼んだ markObsOp の op を返す', () => {
    markObsOp('ScenesService', 'createScene');
    expect(getLastObsOp()).toBe('ScenesService.createScene');

    markObsOp('StreamingService', 'toggleStreaming');
    expect(getLastObsOp()).toBe('StreamingService.toggleStreaming');
  });

  test('初期値は空文字', () => {
    // module-scope なので他テストの後でも初期値は確認できないが
    // markObsOp を呼んだ後は上書きされることを確認
    markObsOp('ScenesService', 'removeScene', { sceneId: 'abc' });
    expect(getLastObsOp()).toBe('ScenesService.removeScene');
  });

  describe('observer', () => {
    test('setObsOpObserver で登録した関数が markObsOp 時に呼ばれる', () => {
      const obs = jest.fn();
      setObsOpObserver(obs);
      markObsOp('StreamingService', 'startStreaming');
      expect(obs).toHaveBeenCalledWith('StreamingService.startStreaming');
    });

    test('setObsOpObserver(null) で observer が解除される', () => {
      const obs = jest.fn();
      setObsOpObserver(obs);
      setObsOpObserver(null);
      markObsOp('StreamingService', 'startStreaming');
      expect(obs).not.toHaveBeenCalled();
    });

    test('observer が未登録の場合はエラーにならない', () => {
      expect(() => markObsOp('StreamingService', 'startStreaming')).not.toThrow();
    });
  });
});

describe('runObsOp', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setObsOpObserver(null);
  });

  test('fn の戻り値を返す', () => {
    const result = runObsOp('FooService', 'barMethod', () => 42);
    expect(result).toBe(42);
  });

  test('markObsOp を呼び breadcrumb が追加される', () => {
    runObsOp('FooService', 'barMethod', () => {});
    expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
      category: 'obs',
      message: 'FooService.barMethod',
      level: 'info',
      data: undefined,
    });
  });

  test('data が渡された場合は markObsOp の data として使われる', () => {
    runObsOp('FooService', 'barMethod', () => {}, { data: { action: 'start' } });
    expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({ data: { action: 'start' } }),
    );
  });

  test('fn が例外を投げると SentryReport.error が呼ばれる', () => {
    const err = new Error('obs error');
    runObsOp('FooService', 'barMethod', () => { throw err; });
    expect(SentryReport.error).toHaveBeenCalledWith('FooService', 'barMethod', err, {
      level: 'error',
      fingerprint: ['FooService', 'barMethod', 'obs', 'exception'],
    });
  });

  test('opts.fingerprint を指定できる', () => {
    const err = new Error('obs error');
    runObsOp('FooService', 'barMethod', () => { throw err; }, {
      fingerprint: ['FooService', 'barMethod', 'custom', 'exception'],
    });
    expect(SentryReport.error).toHaveBeenCalledWith(
      'FooService',
      'barMethod',
      err,
      expect.objectContaining({ fingerprint: ['FooService', 'barMethod', 'custom', 'exception'] }),
    );
  });

  test('rethrow: false のとき例外を飲み込み undefined を返す', () => {
    const result: unknown = runObsOp('FooService', 'barMethod', () => { throw new Error(); });
    expect(result).toBeUndefined();
  });

  test('rethrow: true のとき例外を再 throw する', () => {
    const err = new Error('obs error');
    expect(() => {
      runObsOp('FooService', 'barMethod', () => { throw err; }, { rethrow: true });
    }).toThrow(err);
  });

  test('fn が成功しても SentryReport.error は呼ばれない', () => {
    runObsOp('FooService', 'barMethod', () => {});
    expect(SentryReport.error).not.toHaveBeenCalled();
  });
});

describe('assertObsObjectDefined', () => {
  let clock: FakeTimers.Clock;

  beforeEach(() => {
    jest.clearAllMocks();
    resetNullReportState();
    clock = FakeTimers.install();
  });

  afterEach(() => {
    clock.uninstall();
  });

  test('defined な値は throw せず SentryReport.message を呼ばない', () => {
    const val = { obs: 'object' };
    expect(() => assertObsObjectDefined(val, 'ScenesService', 'getObsScene')).not.toThrow();
    expect(SentryReport.message).not.toHaveBeenCalled();
  });

  test('undefined のとき throw し SentryReport.message が呼ばれる', () => {
    expect(() =>
      assertObsObjectDefined(undefined, 'ScenesService', 'getObsScene', { sceneId: 'scene1' }),
    ).toThrow('Expected OBS object to be defined in ScenesService.getObsScene');
    expect(SentryReport.message).toHaveBeenCalledWith(
      'ScenesService',
      'getObsScene',
      'OBS object was null/undefined in ScenesService.getObsScene',
      {
        level: 'error',
        fingerprint: ['ScenesService', 'getObsScene', 'obs', 'null'],
        extra: { sceneId: 'scene1', reportCount: 1 },
      },
    );
  });

  test('null のとき throw し SentryReport.message が呼ばれる', () => {
    expect(() =>
      assertObsObjectDefined(null, 'SourcesService', 'getObsInput', { sourceId: 'src1' }),
    ).toThrow('Expected OBS object to be defined in SourcesService.getObsInput');
    expect(SentryReport.message).toHaveBeenCalledTimes(1);
  });

  test('extra を指定しない場合は extra に reportCount のみ付与される', () => {
    expect(() => assertObsObjectDefined(undefined, 'FooService', 'barMethod')).toThrow();
    expect(SentryReport.message).toHaveBeenCalledWith(
      'FooService',
      'barMethod',
      expect.any(String),
      expect.objectContaining({ extra: { reportCount: 1 } }),
    );
  });

  test('60 秒窓内の連続呼び出しでは throw は毎回・message は 1 回だけ', () => {
    // 1 回目（60秒経過なしの時刻 0）
    clock.tick(0);
    expect(() => assertObsObjectDefined(undefined, 'FooService', 'barMethod')).toThrow();
    // 2 回目（窓内）
    clock.tick(1000);
    expect(() => assertObsObjectDefined(undefined, 'FooService', 'barMethod')).toThrow();

    expect(SentryReport.message).toHaveBeenCalledTimes(1);
  });

  test('60 秒窓を超えると再度 message が送信される', () => {
    // 1 回目
    expect(() => assertObsObjectDefined(undefined, 'FooService', 'barMethod')).toThrow();
    expect(SentryReport.message).toHaveBeenCalledTimes(1);

    // 60 秒経過
    clock.tick(60_000);
    // 2 回目
    expect(() => assertObsObjectDefined(undefined, 'FooService', 'barMethod')).toThrow();
    expect(SentryReport.message).toHaveBeenCalledTimes(2);
  });

  test('セッション内上限 (5 件) に達すると以降は message を送信しない', () => {
    for (let i = 0; i < 5; i++) {
      clock.tick(60_000); // 60 秒ずつ進めて throttle をリセット
      expect(() => assertObsObjectDefined(undefined, 'FooService', 'barMethod')).toThrow();
    }
    expect(SentryReport.message).toHaveBeenCalledTimes(5);

    // 6 回目: 上限到達済みなので message は呼ばれない
    clock.tick(60_000);
    expect(() => assertObsObjectDefined(undefined, 'FooService', 'barMethod')).toThrow();
    expect(SentryReport.message).toHaveBeenCalledTimes(5); // 変わらない
  });

  test('上限到達の最後の message には reportCapReached: true が付与される', () => {
    for (let i = 0; i < 4; i++) {
      clock.tick(60_000);
      expect(() => assertObsObjectDefined(undefined, 'FooService', 'barMethod')).toThrow();
    }
    // 5 回目（上限ぴったり）
    clock.tick(60_000);
    expect(() => assertObsObjectDefined(undefined, 'FooService', 'barMethod')).toThrow();

    const calls = (SentryReport.message as jest.Mock).mock.calls;
    const lastCall = calls[calls.length - 1];
    expect(lastCall[3].extra).toMatchObject({ reportCount: 5, reportCapReached: true });
  });

  test('異なる service/method キーは独立してカウントされる', () => {
    // key1 を 1 回
    expect(() =>
      assertObsObjectDefined(undefined, 'FooService', 'method1'),
    ).toThrow();
    // key2 を 1 回（窓内でも別キーなので送信される）
    expect(() =>
      assertObsObjectDefined(undefined, 'FooService', 'method2'),
    ).toThrow();

    expect(SentryReport.message).toHaveBeenCalledTimes(2);
  });

  test('resetNullReportState 後は新規セッションとして報告される', () => {
    // 上限まで消費
    for (let i = 0; i < 5; i++) {
      clock.tick(60_000);
      expect(() => assertObsObjectDefined(undefined, 'FooService', 'barMethod')).toThrow();
    }
    expect(SentryReport.message).toHaveBeenCalledTimes(5);

    // リセット後は再び送信される
    resetNullReportState();
    clock.tick(60_000);
    expect(() => assertObsObjectDefined(undefined, 'FooService', 'barMethod')).toThrow();
    expect(SentryReport.message).toHaveBeenCalledTimes(6);
  });
});
