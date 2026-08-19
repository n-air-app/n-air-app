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
  getLastObsOp: jest.fn(() => 'test'),
}));

const mockSentryReportError = jest.fn();
const mockSentryReportMessage = jest.fn();
jest.mock('util/sentry-report', () => ({
  SentryReport: {
    error: (...args: any[]) => mockSentryReportError(...args),
    message: (...args: any[]) => mockSentryReportMessage(...args),
  },
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
      didRemoveSource: jest.fn(),
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

describe('removeSource', () => {
  function setupRemoveSourceInstance(sourceOverrides: any = {}) {
    setup();
    const { SourcesService } = require('./sources');
    const instance = SourcesService.instance();
    // SourcesService.init() は StatefulService.init() をオーバーライドしており、
    // mock 環境では state が自動初期化されないため明示的に設定する
    instance.state = { sources: {}, temporarySources: {} };

    const releaseMock = jest.fn();
    const fakeSourceState = {
      sourceId: 'test-source-id',
      name: 'test-source-id',
      type: 'browser_source',
      channel: undefined,
      ...sourceOverrides,
    };
    const fakeSource = {
      ...fakeSourceState,
      state: fakeSourceState,
      getObsInput: () => ({ release: releaseMock }),
    };

    instance.state.sources['test-source-id'] = fakeSourceState;
    instance.getSource = jest.fn((id: string) => (id === 'test-source-id' ? fakeSource : undefined));
    instance.propertiesManagers = {
      'test-source-id': { manager: { destroy: jest.fn() }, type: 'default' },
    };
    instance.sourceRemoved = { next: jest.fn() };

    return { instance, fakeSource, releaseMock };
  }

  test('正常時は propertiesManagers から削除され sourceRemoved が発火する', () => {
    const { instance, fakeSource } = setupRemoveSourceInstance();

    instance.removeSource('test-source-id');

    expect(instance.propertiesManagers['test-source-id']).toBeUndefined();
    expect(instance.state.sources['test-source-id']).toBeUndefined();
    expect(instance.sourceRemoved.next).toHaveBeenCalledWith(fakeSource.state);
  });

  test('sourceRemoved.next には REMOVE_SOURCE 前のスナップショットが渡される（state delete 後の評価順バグ回避）', () => {
    const { instance } = setupRemoveSourceInstance({ audio: true });

    instance.removeSource('test-source-id');

    // REMOVE_SOURCE で state.sources から削除された後でも、
    // next に渡された値には削除前の内容（sourceId / audio）が正しく残っていること
    expect(instance.sourceRemoved.next).toHaveBeenCalledWith(
      expect.objectContaining({ sourceId: 'test-source-id', audio: true }),
    );
  });

  test('存在しない id では Source not found を throw する', () => {
    const { instance } = setupRemoveSourceInstance();
    instance.getSource = jest.fn().mockReturnValue(undefined);

    expect(() => instance.removeSource('unknown-id')).toThrow('Source unknown-id not found');
  });

  test('nair-rtvc-source の場合 didRemoveSource が呼ばれる', () => {
    const { instance } = setupRemoveSourceInstance({ type: 'nair-rtvc-source' });

    instance.removeSource('test-source-id');

    expect(instance.rtvcStateService.didRemoveSource).toHaveBeenCalled();
  });

  test('propertiesManagers にエントリが無くても REMOVE_SOURCE / sourceRemoved まで到達する', () => {
    const { instance } = setupRemoveSourceInstance();
    instance.propertiesManagers = {}; // エントリ欠落を再現

    instance.removeSource('test-source-id');

    expect(instance.state.sources['test-source-id']).toBeUndefined();
    expect(instance.sourceRemoved.next).toHaveBeenCalled();
  });

  test('propertiesManagers 欠落時は SentryReport.message で警告する', () => {
    const { instance } = setupRemoveSourceInstance();
    instance.propertiesManagers = {};

    instance.removeSource('test-source-id');

    expect(mockSentryReportMessage).toHaveBeenCalledWith(
      'SourcesService',
      'removeSource',
      'propertiesManager missing on removeSource',
      expect.objectContaining({
        fingerprint: ['SourcesService', 'removeSource', 'managerMissing'],
      }),
    );
  });

  test('manager.destroy() が throw しても REMOVE_SOURCE まで到達する', () => {
    const { instance } = setupRemoveSourceInstance();
    instance.propertiesManagers['test-source-id'].manager.destroy = jest.fn(() => {
      throw new Error('destroy failed');
    });

    instance.removeSource('test-source-id');

    expect(instance.state.sources['test-source-id']).toBeUndefined();
    expect(instance.sourceRemoved.next).toHaveBeenCalled();
  });

  test('release() が throw しても REMOVE_SOURCE まで到達する', () => {
    const { instance, releaseMock } = setupRemoveSourceInstance();
    releaseMock.mockImplementation(() => {
      throw new Error('release failed');
    });

    instance.removeSource('test-source-id');

    expect(instance.state.sources['test-source-id']).toBeUndefined();
    expect(instance.sourceRemoved.next).toHaveBeenCalled();
  });

  test('channel が設定されたソースで setOutputSource が throw しても REMOVE_SOURCE まで到達する', () => {
    const { instance } = setupRemoveSourceInstance({ channel: 1 });
    const obs = require('../../../obs-api');
    obs.Global.setOutputSource.mockImplementation(() => {
      throw new Error('Failed to make IPC call, verify IPC status.');
    });

    instance.removeSource('test-source-id');

    expect(instance.state.sources['test-source-id']).toBeUndefined();
    expect(instance.sourceRemoved.next).toHaveBeenCalled();

    obs.Global.setOutputSource.mockReset();
  });

  test('各ステップの失敗は step ごとの fingerprint で SentryReport.error される', () => {
    const { instance, releaseMock } = setupRemoveSourceInstance();
    releaseMock.mockImplementation(() => {
      throw new Error('release failed');
    });

    instance.removeSource('test-source-id');

    expect(mockSentryReportError).toHaveBeenCalledWith(
      'SourcesService',
      'removeSource',
      expect.anything(),
      expect.objectContaining({
        fingerprint: ['SourcesService', 'removeSource', 'release'],
      }),
    );
  });
});

describe('reset', () => {
  test('reset() で propertiesManagers が空になり各 manager の destroy が呼ばれる', () => {
    setup();
    const { SourcesService } = require('./sources');
    const instance = SourcesService.instance();
    instance.state = { sources: {}, temporarySources: {} };

    const destroyA = jest.fn();
    const destroyB = jest.fn();
    instance.propertiesManagers = {
      a: { manager: { destroy: destroyA }, type: 'default' },
      b: { manager: { destroy: destroyB }, type: 'default' },
    };

    instance.reset();

    expect(destroyA).toHaveBeenCalled();
    expect(destroyB).toHaveBeenCalled();
    expect(instance.propertiesManagers).toEqual({});
  });

  test('manager.destroy() が throw しても propertiesManagers は空になる', () => {
    setup();
    const { SourcesService } = require('./sources');
    const instance = SourcesService.instance();
    instance.state = { sources: {}, temporarySources: {} };

    instance.propertiesManagers = {
      a: {
        manager: {
          destroy: jest.fn(() => {
            throw new Error('destroy failed');
          }),
        },
        type: 'default',
      },
    };

    expect(() => instance.reset()).not.toThrow();
    expect(instance.propertiesManagers).toEqual({});
  });
});

describe('fixSourceSettings', () => {
  function createFakeWebcam(videoDeviceId: string | undefined) {
    return {
      getSettings: jest.fn().mockReturnValue({ video_device_id: videoDeviceId }),
      updateSettings: jest.fn(),
      getPropertiesFormData: jest.fn(),
    };
  }

  test('video_device_id が空文字の場合、先頭デバイスで補完する', () => {
    setup();
    mockGetVideoDevices.mockReturnValue([{ id: 'video_device_0', name: 'Webcam' }]);

    const { SourcesService } = require('./sources');
    const instance = SourcesService.instance();

    const webcam = createFakeWebcam('');
    instance.getSourcesByType = jest.fn().mockReturnValue([webcam]);

    instance.fixSourceSettings();

    expect(webcam.updateSettings).toHaveBeenCalledWith({ video_device_id: 'video_device_0' });
    expect(webcam.getPropertiesFormData).toHaveBeenCalled();
  });

  test('video_device_id が未設定 (undefined) の場合、先頭デバイスで補完する', () => {
    setup();
    mockGetVideoDevices.mockReturnValue([{ id: 'video_device_0', name: 'Webcam' }]);

    const { SourcesService } = require('./sources');
    const instance = SourcesService.instance();

    const webcam = createFakeWebcam(undefined);
    instance.getSourcesByType = jest.fn().mockReturnValue([webcam]);

    instance.fixSourceSettings();

    expect(webcam.updateSettings).toHaveBeenCalledWith({ video_device_id: 'video_device_0' });
  });

  test('video_device_id に有効な値が既にある場合は補完しない', () => {
    setup();
    mockGetVideoDevices.mockReturnValue([{ id: 'video_device_0', name: 'Webcam' }]);

    const { SourcesService } = require('./sources');
    const instance = SourcesService.instance();

    const webcam = createFakeWebcam('existing_device_id');
    instance.getSourcesByType = jest.fn().mockReturnValue([webcam]);

    instance.fixSourceSettings();

    expect(webcam.updateSettings).not.toHaveBeenCalled();
    expect(webcam.getPropertiesFormData).toHaveBeenCalled();
  });

  test('デバイスが1つも無い場合は何もしない', () => {
    setup();
    mockGetVideoDevices.mockReturnValue([]);

    const { SourcesService } = require('./sources');
    const instance = SourcesService.instance();

    const webcam = createFakeWebcam('');
    instance.getSourcesByType = jest.fn().mockReturnValue([webcam]);

    instance.fixSourceSettings();

    expect(webcam.updateSettings).not.toHaveBeenCalled();
  });
});
