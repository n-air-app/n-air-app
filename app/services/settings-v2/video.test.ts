// stateful-service と injector は video.ts が import するものを先にモックする
import type { IVideoInfo } from '../../../obs-api';

jest.mock('services/core/stateful-service', () => ({
  StatefulService: class {
    static initialState: any = {};
    static store: any = { watch: jest.fn() };
    static getState() { return {}; }
    get state() { return (this.constructor as any)._state ?? {}; }
  },
  mutation: () => (_target: any, _key: string, descriptor: any) => descriptor,
}));
jest.mock('services/core/injector', () => ({
  Inject: () => (_target: any, _key: string) => {},
}));
jest.mock('services/settings', () => ({ SettingsService: class {} }));
jest.mock('util/getKeys', () => ({
  getKeys: (obj: any) => Object.keys(obj),
}));
jest.mock('util/sentry-obs-breadcrumb', () => ({
  markObsOp: jest.fn(),
}));
jest.mock('lodash/debounce', () => (fn: any) => {
  const debounced = (...args: any[]) => fn(...args);
  debounced.cancel = jest.fn();
  return debounced;
});
jest.mock('rxjs', () => ({ Subject: class { next() {} } }));

const mockVideoFactory = { create: jest.fn() };
const mockVideo = {};
jest.mock('../../../obs-api', () => ({
  EColorSpace: { CS709: 1 },
  EFPSType: { Integer: 0 },
  ERangeType: { Full: 0 },
  EScaleType: { Bilinear: 0 },
  EVideoFormat: { I420: 0 },
  VideoFactory: mockVideoFactory,
  Video: mockVideo,
}));

// デフォルト IVideoInfo の生成ヘルパ
function makeVideoInfo(overrides: Partial<IVideoInfo> = {}): IVideoInfo {
  return {
    fpsNum: 30,
    fpsDen: 1,
    baseWidth: 1280,
    baseHeight: 720,
    outputWidth: 1280,
    outputHeight: 720,
    outputFormat: 0, // EVideoFormat.I420
    colorspace: 1, // EColorSpace.CS709
    range: 0, // ERangeType.Full
    scaleType: 0, // EScaleType.Bilinear
    fpsType: 0, // EFPSType.Integer
    ...overrides,
  };
}

// ---- isVideoInfoEqual の単体テスト ----
describe('isVideoInfoEqual', () => {
  let isVideoInfoEqual: (a: IVideoInfo | null | undefined, b: IVideoInfo | null | undefined) => boolean;

  beforeEach(() => {
    jest.resetModules();
    // モックが正しく読み込まれた状態でターゲットを require
    ({ isVideoInfoEqual } = require('./video'));
  });

  test('同一オブジェクト (参照一致) → true', () => {
    const info = makeVideoInfo();
    expect(isVideoInfoEqual(info, info)).toBe(true);
  });

  test('全フィールドが同じ別オブジェクト → true', () => {
    expect(isVideoInfoEqual(makeVideoInfo(), makeVideoInfo())).toBe(true);
  });

  test('baseWidth が異なる → false', () => {
    expect(isVideoInfoEqual(makeVideoInfo({ baseWidth: 1280 }), makeVideoInfo({ baseWidth: 1920 }))).toBe(false);
  });

  test('outputWidth が異なる → false', () => {
    expect(isVideoInfoEqual(makeVideoInfo({ outputWidth: 1280 }), makeVideoInfo({ outputWidth: 1920 }))).toBe(false);
  });

  test('fpsNum が異なる → false', () => {
    expect(isVideoInfoEqual(makeVideoInfo({ fpsNum: 30 }), makeVideoInfo({ fpsNum: 60 }))).toBe(false);
  });

  test('a が null, b が null → true', () => {
    expect(isVideoInfoEqual(null, null)).toBe(true);
  });

  test('a が null, b が IVideoInfo → false', () => {
    expect(isVideoInfoEqual(null, makeVideoInfo())).toBe(false);
  });

  test('a が IVideoInfo, b が null → false', () => {
    expect(isVideoInfoEqual(makeVideoInfo(), null)).toBe(false);
  });
});

// ---- VideoSettingsService.refrectLegacy のテスト ----
describe('VideoSettingsService.refrectLegacy', () => {
  let VideoSettingsService: any;
  let markObsOpMock: jest.Mock;
  let instance: any;
  let mockContext: { video: IVideoInfo; legacySettings: IVideoInfo; videoSetterCallCount: number };

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    ({ VideoSettingsService } = require('./video'));
    ({ markObsOp: markObsOpMock } = require('util/sentry-obs-breadcrumb'));

    // VideoSettingsService のインスタンスを手動構築
    instance = Object.create(VideoSettingsService.prototype);

    // contexts のモック: video の getter/setter を追跡可能にする
    let _video = makeVideoInfo();
    mockContext = {
      get video() { return _video; },
      set video(v: IVideoInfo) {
        mockContext.videoSetterCallCount++;
        _video = v;
      },
      get legacySettings() { return _video; },
      set legacySettings(v: IVideoInfo) { _video = v; },
      videoSetterCallCount: 0,
    };

    instance.contexts = { horizontal: mockContext };

    // state のモック（StatefulService のモックが state を getter-only にするため defineProperty で上書き）
    const mockState = { horizontal: makeVideoInfo() };
    Object.defineProperty(instance, 'state', {
      get: () => mockState,
      configurable: true,
    });
    instance.SET_VIDEO_SETTING = jest.fn((key: string, value: unknown, display: string = 'horizontal') => {
      mockState[display as keyof typeof mockState] = { ...mockState[display as keyof typeof mockState], [key]: value };
    });
  });

  describe('A案: 同値スキップ', () => {
    test('legacySettings と native video が全フィールド一致のとき .video setter が呼ばれない', () => {
      const info = makeVideoInfo();
      // legacySettings = native video と同値
      let _native = { ...info };
      let videoSetterCalled = false;
      Object.defineProperty(instance.contexts.horizontal, 'video', {
        get: () => _native,
        set: (v: IVideoInfo) => { videoSetterCalled = true; _native = v; },
        configurable: true,
      });
      Object.defineProperty(instance.contexts.horizontal, 'legacySettings', {
        get: () => ({ ...info }),
        configurable: true,
      });

      instance.refrectLegacy('horizontal');

      expect(videoSetterCalled).toBe(false);
    });

    test('legacySettings と native video が異なるとき .video setter が呼ばれる', () => {
      const currentNative = makeVideoInfo({ outputWidth: 1920, outputHeight: 1080 });
      const newLegacy = makeVideoInfo({ outputWidth: 1280, outputHeight: 720 });
      let _native = { ...currentNative };
      let videoSetterCalled = false;
      Object.defineProperty(instance.contexts.horizontal, 'video', {
        get: () => _native,
        set: (v: IVideoInfo) => { videoSetterCalled = true; _native = v; },
        configurable: true,
      });
      Object.defineProperty(instance.contexts.horizontal, 'legacySettings', {
        get: () => ({ ...newLegacy }),
        configurable: true,
      });

      instance.refrectLegacy('horizontal');

      expect(videoSetterCalled).toBe(true);
    });
  });

  describe('A案: 0x0 補完', () => {
    test('legacySettings の outputWidth=0 は baseWidth で補完される', () => {
      const legacy = makeVideoInfo({ outputWidth: 0, outputHeight: 0, baseWidth: 1280, baseHeight: 720 });
      let appliedValue: IVideoInfo | null = null;
      Object.defineProperty(instance.contexts.horizontal, 'video', {
        get: () => ({ ...legacy, outputWidth: 999, outputHeight: 999 }), // 現在値と違う値にして setter が呼ばれるようにする
        set: (v: IVideoInfo) => { appliedValue = v; },
        configurable: true,
      });
      Object.defineProperty(instance.contexts.horizontal, 'legacySettings', {
        get: () => ({ ...legacy }),
        configurable: true,
      });

      instance.refrectLegacy('horizontal');

      expect(appliedValue).not.toBeNull();
      expect(appliedValue!.outputWidth).toBe(1280);
      expect(appliedValue!.outputHeight).toBe(720);
    });
  });

  describe('C案: エラー格下げ（安全網）', () => {
    test('.video setter が throw しても refrectLegacy が再 throw しない（warn 格下げ）', () => {
      const currentNative = makeVideoInfo({ outputWidth: 1920 }); // 異なる値にして setter が呼ばれるように
      const legacy = makeVideoInfo({ outputWidth: 1280 });
      Object.defineProperty(instance.contexts.horizontal, 'video', {
        get: () => ({ ...currentNative }),
        set: () => { throw new Error('IPC error code 1'); },
        configurable: true,
      });
      Object.defineProperty(instance.contexts.horizontal, 'legacySettings', {
        get: () => ({ ...legacy }),
        configurable: true,
      });
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      // throw しないこと（loadErrorMessage ダイアログに到達しない）を確認
      expect(() => instance.refrectLegacy('horizontal')).not.toThrow();
      consoleSpy.mockRestore();
    });

    test('.video setter が throw したとき markObsOp が呼ばれる', () => {
      const currentNative = makeVideoInfo({ outputWidth: 1920 });
      const legacy = makeVideoInfo({ outputWidth: 1280 });
      Object.defineProperty(instance.contexts.horizontal, 'video', {
        get: () => ({ ...currentNative }),
        set: () => { throw new Error('IPC error code 1'); },
        configurable: true,
      });
      Object.defineProperty(instance.contexts.horizontal, 'legacySettings', {
        get: () => ({ ...legacy }),
        configurable: true,
      });
      jest.spyOn(console, 'warn').mockImplementation(() => {});

      instance.refrectLegacy('horizontal');

      expect(markObsOpMock).toHaveBeenCalledWith(
        'VideoSettingsService',
        'refrectLegacy',
        expect.objectContaining({ display: 'horizontal' }),
      );
    });

    test('.video setter が throw しても SET_VIDEO_SETTING は実行される（front-end state 更新）', () => {
      const currentNative = makeVideoInfo({ outputWidth: 1920 });
      const legacy = makeVideoInfo({ outputWidth: 1280 });
      Object.defineProperty(instance.contexts.horizontal, 'video', {
        get: () => ({ ...currentNative }),
        set: () => { throw new Error('IPC error code 1'); },
        configurable: true,
      });
      Object.defineProperty(instance.contexts.horizontal, 'legacySettings', {
        get: () => ({ ...legacy }),
        configurable: true,
      });
      jest.spyOn(console, 'warn').mockImplementation(() => {});

      instance.refrectLegacy('horizontal');

      // front-end state の同期は try/catch 外なので実行される
      expect(instance.SET_VIDEO_SETTING).toHaveBeenCalled();
    });
  });
});

describe('VideoSettingsService.shutdown', () => {
  let VideoSettingsService: any;
  let markObsOpMock: jest.Mock;
  let instance: any;
  let mockState: { horizontal: IVideoInfo | null };

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    ({ VideoSettingsService } = require('./video'));
    ({ markObsOp: markObsOpMock } = require('util/sentry-obs-breadcrumb'));

    instance = Object.create(VideoSettingsService.prototype);
    instance.debouncedUpdateObsSettings = { cancel: jest.fn() };
    mockState = { horizontal: makeVideoInfo() };
    Object.defineProperty(instance, 'state', {
      get: () => mockState,
      configurable: true,
    });
    instance.DESTROY_VIDEO_CONTEXT = jest.fn((display: 'horizontal') => {
      mockState[display] = null;
    });
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('legacySettings の保存に失敗しても context を destroy してローカル状態を破棄する', () => {
    const destroy = jest.fn();
    const context = { destroy } as any;
    Object.defineProperty(context, 'legacySettings', {
      set: () => { throw new Error('IPC received error code 1'); },
    });
    instance.contexts = { horizontal: context };

    expect(() => instance.shutdown()).not.toThrow();

    expect(destroy).toHaveBeenCalledTimes(1);
    expect(instance.contexts.horizontal).toBeNull();
    expect(instance.DESTROY_VIDEO_CONTEXT).toHaveBeenCalledWith('horizontal');
    expect(markObsOpMock).toHaveBeenCalledWith(
      'VideoSettingsService',
      'shutdown',
      expect.objectContaining({
        display: 'horizontal',
        operation: 'saveLegacySettings',
        error: 'IPC received error code 1',
      }),
    );
  });

  test('context の destroy に失敗してもローカル状態を破棄する', () => {
    const expectedLegacySettings = mockState.horizontal;
    const context = {
      legacySettings: null,
      destroy: jest.fn(() => { throw new Error('IPC received error code 1'); }),
    } as any;
    instance.contexts = { horizontal: context };

    expect(() => instance.shutdown()).not.toThrow();

    expect(context.legacySettings).toEqual(expectedLegacySettings);
    expect(instance.contexts.horizontal).toBeNull();
    expect(instance.DESTROY_VIDEO_CONTEXT).toHaveBeenCalledWith('horizontal');
    expect(markObsOpMock).toHaveBeenCalledWith(
      'VideoSettingsService',
      'shutdown',
      expect.objectContaining({
        display: 'horizontal',
        operation: 'destroyContext',
        error: 'IPC received error code 1',
      }),
    );
  });
});
