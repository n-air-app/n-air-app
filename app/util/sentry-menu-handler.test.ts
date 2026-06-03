import * as Sentry from '@sentry/vue';

import { withMenuHandlerTag } from './sentry-menu-handler';

jest.mock('@sentry/vue', () => ({
  withScope: jest.fn(),
  captureException: jest.fn(),
}));

describe('withMenuHandlerTag', () => {
  let mockScope: {
    setLevel: jest.Mock;
    setTag: jest.Mock;
    setExtra: jest.Mock;
    setFingerprint: jest.Mock;
    setContext: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockScope = {
      setLevel: jest.fn(),
      setTag: jest.fn(),
      setExtra: jest.fn(),
      setFingerprint: jest.fn(),
      setContext: jest.fn(),
    };
    (Sentry.withScope as jest.Mock).mockImplementation((cb) => cb(mockScope));
  });

  test('正常終了時は Sentry を呼ばない', () => {
    const result = withMenuHandlerTag('TestHandler', () => 42);
    expect(result).toBe(42);
    expect(Sentry.withScope).not.toHaveBeenCalled();
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  test('throw 時に service/method タグと captureException を送信して再 throw する', () => {
    const err = new Error('test error');
    let thrown: unknown;
    try {
      withMenuHandlerTag('SceneSelector.Duplicate', () => {
        throw err;
      });
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBe(err);
    expect(Sentry.withScope).toHaveBeenCalledTimes(1);
    expect(mockScope.setTag).toHaveBeenCalledWith('service', 'MenuHandler');
    expect(mockScope.setTag).toHaveBeenCalledWith('method', 'SceneSelector.Duplicate');
    expect(Sentry.captureException).toHaveBeenCalledWith(err);
  });

  test('getExtra が渡された場合は setContext("menu", ...) を呼ぶ', () => {
    const err = new Error('test');
    const extra = { activeSceneIsNull: true, sceneCount: 0 };
    let thrown: unknown;
    try {
      withMenuHandlerTag(
        'SceneSelector.Filters',
        () => {
          throw err;
        },
        () => extra,
      );
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBe(err);
    expect(mockScope.setContext).toHaveBeenCalledWith('menu', extra);
  });

  test('getExtra が throw しても元の例外が再 throw される', () => {
    const originalErr = new Error('original');
    let thrown: unknown;
    try {
      withMenuHandlerTag(
        'Test',
        () => {
          throw originalErr;
        },
        () => {
          throw new Error('extra collection failed');
        },
      );
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBe(originalErr);
    expect(Sentry.captureException).toHaveBeenCalledWith(originalErr);
  });

  test('getExtra が省略された場合は setContext を呼ばない', () => {
    const err = new Error('no extra');
    try {
      withMenuHandlerTag('Test.NoExtra', () => {
        throw err;
      });
    } catch {
      // expected
    }
    expect(mockScope.setContext).not.toHaveBeenCalled();
  });
});
