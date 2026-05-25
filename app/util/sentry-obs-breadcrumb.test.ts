import * as Sentry from '@sentry/vue';

import { captureServiceError } from './sentry-capture';
import { getLastObsOp, markObsOp, runObsOp, setObsOpObserver } from './sentry-obs-breadcrumb';

jest.mock('@sentry/vue', () => ({
  addBreadcrumb: jest.fn(),
  setTag: jest.fn(),
}));

jest.mock('./sentry-capture', () => ({
  captureServiceError: jest.fn(),
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

  test('fn が例外を投げると captureServiceError が呼ばれる', () => {
    const err = new Error('obs error');
    runObsOp('FooService', 'barMethod', () => { throw err; });
    expect(captureServiceError).toHaveBeenCalledWith('FooService', 'barMethod', err, {
      level: 'error',
      fingerprint: ['FooService', 'barMethod', 'obs', 'exception'],
    });
  });

  test('opts.fingerprint を指定できる', () => {
    const err = new Error('obs error');
    runObsOp('FooService', 'barMethod', () => { throw err; }, {
      fingerprint: ['FooService', 'barMethod', 'custom', 'exception'],
    });
    expect(captureServiceError).toHaveBeenCalledWith(
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

  test('fn が成功しても captureServiceError は呼ばれない', () => {
    runObsOp('FooService', 'barMethod', () => {});
    expect(captureServiceError).not.toHaveBeenCalled();
  });
});
