/**
 * SourcesService.createSource のテスト
 *
 * ネイティブクラッシュ時にソースタイプを特定できるよう Sentry タグを設定する機能と、
 * InputFactory.create の null/undefined 戻り値に対する null ガードをテストする。
 */
import { createSetupFunction } from 'util/test-setup';

const mockSetTag = jest.fn();
jest.mock('@sentry/vue', () => ({
  setTag: mockSetTag,
  addBreadcrumb: jest.fn(),
}));

const mockMarkObsOp = jest.fn();
jest.mock('util/sentry-obs-breadcrumb', () => ({
  markObsOp: mockMarkObsOp,
  setObsOpObserver: jest.fn(),
  getLastObsOp: jest.fn(),
}));

// OBS ネイティブモジュールのモック（sources.ts は '../../../obs-api' で import している）
const mockCreate = jest.fn();
const mockGetVideoDevices = jest.fn().mockReturnValue([]);
jest.mock('../../../obs-api', () => ({
  InputFactory: {
    create: (...args: any[]) => mockCreate(...args),
    types: jest.fn().mockReturnValue([]),
  },
  NodeObs: {
    RegisterSourceCallback: jest.fn(),
    OBS_settings_getVideoDevices: (...args: any[]) => mockGetVideoDevices(...args),
  },
  Global: {
    setOutputSource: jest.fn(),
  },
  ESourceOutputFlags: {
    Audio: 1,
    Video: 2,
    Async: 4,
    DoNotDuplicate: 8,
  },
}));

jest.mock('services/core/stateful-service');
jest.mock('services/core/injector');
jest.mock('services/core/service-initialization-observer', () => ({
  InitAfter: () => () => {},
}));
// source.ts の @ServiceHelper デコレータが inheritMutations を使うため補完
jest.mock('services/core/service-helper', () => ({
  ServiceHelper: () => () => {},
}));

const setup = createSetupFunction({
  state: {
    SourcesService: {
      sources: {},
      temporarySources: {},
    },
  },
  injectee: {
    ScenesService: {
      itemRemoved: { subscribe: jest.fn() },
      sceneRemoved: { subscribe: jest.fn() },
    },
    WindowsService: {
      createOneOffWindow: jest.fn(),
    },
    AudioService: {
      getSource: jest.fn(),
    },
    UserService: {},
    RtvcStateService: {
      didAddSource: jest.fn(),
    },
  },
});

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
});

describe('createSource', () => {
  test('ネイティブ呼び出し前に source.createType Sentry タグを設定する', () => {
    setup();

    const fakeObsInput = {
      name: 'browser_source_test-id',
      id: 'browser_source',
      width: 800,
      height: 600,
      muted: false,
      outputFlags: 2,
      release: jest.fn(),
    };
    mockCreate.mockReturnValue(fakeObsInput);

    const { SourcesService } = require('./sources');
    const instance = SourcesService.instance();

    instance.propertiesManagers = {};
    instance.sourceAdded = { next: jest.fn() };

    try {
      instance.createSource('テストブラウザソース', 'browser_source', {});
    } catch {
      // addSource 内部の例外は無視（全モックが揃っていない可能性あり）
    }

    // Sentry.setTag が source.createType = 'browser_source' で呼ばれたこと
    expect(mockSetTag).toHaveBeenCalledWith('source.createType', 'browser_source');

    // markObsOp も呼ばれていること（既存の breadcrumb 記録も維持されている）
    expect(mockMarkObsOp).toHaveBeenCalledWith('SourcesService', 'createSource', { type: 'browser_source' });
  });

  test('ソースタイプが Sentry タグに反映される（dshow_input の場合）', () => {
    setup();

    const fakeObsInput = {
      name: 'dshow_input_test-id',
      id: 'dshow_input',
      width: 1280,
      height: 720,
      muted: false,
      outputFlags: 3,
      release: jest.fn(),
    };
    mockCreate.mockReturnValue(fakeObsInput);
    mockGetVideoDevices.mockReturnValue([{ id: 'video_device_0', name: 'Webcam' }]);

    const { SourcesService } = require('./sources');
    const instance = SourcesService.instance();
    instance.propertiesManagers = {};
    instance.sourceAdded = { next: jest.fn() };

    try {
      instance.createSource('Webcam', 'dshow_input', {});
    } catch {
      // 内部例外は無視
    }

    expect(mockSetTag).toHaveBeenCalledWith('source.createType', 'dshow_input');
  });

  test('InputFactory.create が null を返した場合にエラーを投げる', () => {
    setup();
    mockCreate.mockReturnValue(null);

    const { SourcesService } = require('./sources');
    const instance = SourcesService.instance();
    instance.propertiesManagers = {};
    instance.sourceAdded = { next: jest.fn() };

    expect(() => {
      instance.createSource('テストソース', 'monitor_capture', {});
    }).toThrow('InputFactory.create returned no input for type=monitor_capture');

    // null が返された場合でも、その前に setTag は呼ばれている
    expect(mockSetTag).toHaveBeenCalledWith('source.createType', 'monitor_capture');
  });

  test('InputFactory.create が undefined を返した場合にエラーを投げる', () => {
    setup();
    mockCreate.mockReturnValue(undefined);

    const { SourcesService } = require('./sources');
    const instance = SourcesService.instance();
    instance.propertiesManagers = {};
    instance.sourceAdded = { next: jest.fn() };

    expect(() => {
      instance.createSource('テストソース', 'window_capture', {});
    }).toThrow('InputFactory.create returned no input for type=window_capture');
  });
});
