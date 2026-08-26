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
  EFPSType: { Integer: 0 },
  EScaleType: { Bilinear: 0 },
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
    jest.spyOn(console, 'warn').mockImplementation(() => {});
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
    const error = new Error('IPC received error code 1');
    const context = {
      legacySettings: null,
      destroy: jest.fn(() => { throw error; }),
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
    expect(console.warn).toHaveBeenCalledWith(
      '[VideoSettingsService] shutdown(horizontal): video context was already unavailable; destroyContext cleanup failure ignored:',
      error,
    );
  });
});
