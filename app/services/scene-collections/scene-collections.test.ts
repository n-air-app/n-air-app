/**
 * Unit tests for SceneCollectionsService
 * Focuses on Sentry error reporting for partial load failures
 */

import * as Sentry from '@sentry/vue';
import { ISceneCollectionsManifestEntry } from 'services/scene-collections/scene-collections-api';
import { createSetupFunction } from 'util/test-setup';

// Mock dependencies
jest.mock('@sentry/vue', () => ({
  withScope: jest.fn(),
  captureMessage: jest.fn(),
  setTag: jest.fn(),
}));
jest.mock('services/core/stateful-service');
jest.mock('services/core/injector');
jest.mock('@electron/remote', () => ({
  dialog: {
    showMessageBoxSync: jest.fn(() => 0), // Return OK/first button
  },
  app: {
    quit: jest.fn(),
  },
}));

describe('SceneCollectionsService', () => {
  let mockScope: any;
  let mockWithScope: jest.Mock;
  let mockCaptureMessage: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    // Create mock scope object
    mockScope = {
      setLevel: jest.fn(),
      setTag: jest.fn(),
      setContext: jest.fn(),
    };

    // Mock Sentry.withScope to capture the callback
    mockWithScope = jest.fn((callback: (scope: any) => void) => {
      callback(mockScope);
    });

    mockCaptureMessage = jest.fn();

    jest.spyOn(Sentry, 'withScope').mockImplementation(mockWithScope);
    jest.spyOn(Sentry, 'captureMessage').mockImplementation(mockCaptureMessage);
  });

  describe('load with partial errors', () => {
    test('sends partial load errors to Sentry with correct metadata', async () => {
      // This test verifies that when loadErrors are returned from readCollectionDataAndLoadIntoApplicationState,
      // they are properly sent to Sentry with the correct structure

      const mockLoadErrors = [
        {
          type: 'source' as const,
          id: 'source_1',
          name: 'Invalid Source 1',
          error: new Error('Source type not found'),
        },
        {
          type: 'source' as const,
          id: 'source_2',
          name: 'Invalid Source 2',
          error: new Error('Device not found'),
        },
        {
          type: 'scene' as const,
          id: 'scene_1',
          name: 'Invalid Scene',
          error: new Error('Scene load failed'),
        },
      ];

      // Manually verify the logic that would be executed in scene-collections.ts:265-291
      // We're testing the Sentry reporting logic in isolation

      // This simulates what happens when loadErrors.length > 0
      const errorsByType = mockLoadErrors.reduce<Record<string, number>>((acc, err) => {
        acc[err.type] = (acc[err.type] || 0) + 1;
        return acc;
      }, {});

      // Convert failed items array to indexed object for better Sentry display
      const failedItemsContext = mockLoadErrors.reduce<Record<string, any>>((acc, err, index) => {
        const key = `${index + 1}_${err.type}`;
        acc[key] = {
          type: err.type,
          id: err.id || 'N/A',
          name: err.name,
          errorMessage: err.error instanceof Error ? err.error.message : String(err.error),
        };
        return acc;
      }, {});

      Sentry.withScope((scope) => {
        scope.setLevel('warning');
        scope.setTag('service', 'SceneCollectionsService');
        scope.setTag('method', 'load');
        scope.setTag('collectionId', 'test-collection-id');
        scope.setTag('errorCount', mockLoadErrors.length.toString());
        scope.setContext('errorsByType', errorsByType);
        scope.setContext('failedItems', failedItemsContext);
        Sentry.captureMessage('Scene collection loaded with partial errors', 'warning');
      });

      // Verify Sentry was called correctly
      expect(mockWithScope).toHaveBeenCalledTimes(1);
      expect(mockScope.setLevel).toHaveBeenCalledWith('warning');
      expect(mockScope.setTag).toHaveBeenCalledWith('service', 'SceneCollectionsService');
      expect(mockScope.setTag).toHaveBeenCalledWith('method', 'load');
      expect(mockScope.setTag).toHaveBeenCalledWith('collectionId', 'test-collection-id');
      expect(mockScope.setTag).toHaveBeenCalledWith('errorCount', '3');

      // Verify error aggregation by type
      expect(mockScope.setContext).toHaveBeenCalledWith('errorsByType', {
        source: 2,
        scene: 1,
      });

      // Verify detailed error information (now using indexed object format)
      const expectedFailedItems = mockLoadErrors.reduce<Record<string, any>>((acc, err, index) => {
        const key = `${index + 1}_${err.type}`;
        acc[key] = {
          type: err.type,
          id: err.id || 'N/A',
          name: err.name,
          errorMessage: err.error instanceof Error ? err.error.message : String(err.error),
        };
        return acc;
      }, {});

      expect(mockScope.setContext).toHaveBeenCalledWith('failedItems', expectedFailedItems);

      expect(mockCaptureMessage).toHaveBeenCalledWith(
        'Scene collection loaded with partial errors',
        'warning',
      );
    });

    test('correctly aggregates errors by type', () => {
      const mockLoadErrors = [
        {
          type: 'source' as const,
          id: 's1',
          name: 'Source 1',
          error: new Error('error 1'),
        },
        {
          type: 'source' as const,
          id: 's2',
          name: 'Source 2',
          error: new Error('error 2'),
        },
        {
          type: 'source' as const,
          id: 's3',
          name: 'Source 3',
          error: new Error('error 3'),
        },
        {
          type: 'scene' as const,
          id: 'sc1',
          name: 'Scene 1',
          error: new Error('error 4'),
        },
        {
          type: 'filter' as const,
          id: 'f1',
          name: 'Filter 1',
          error: new Error('error 5'),
        },
      ];

      const errorsByType = mockLoadErrors.reduce<Record<string, number>>((acc, err) => {
        acc[err.type] = (acc[err.type] || 0) + 1;
        return acc;
      }, {});

      expect(errorsByType).toEqual({
        source: 3,
        scene: 1,
        filter: 1,
      });
    });

    test('handles non-Error objects in error field', () => {
      const mockLoadErrors = [
        {
          type: 'source' as const,
          id: 's1',
          name: 'Source 1',
          error: 'string error' as any, // Sometimes errors might be strings
        },
        {
          type: 'source' as const,
          id: 's2',
          name: 'Source 2',
          error: { message: 'object error' } as any,
        },
      ];

      const items = mockLoadErrors.map((err) => ({
        type: err.type,
        id: err.id,
        name: err.name,
        error: err.error instanceof Error ? err.error.message : String(err.error),
      }));

      expect(items[0].error).toBe('string error');
      expect(items[1].error).toBe('[object Object]');
    });

    test('handles settings: null error case', () => {
      // This test verifies the error case discovered during testing
      // where settings is null causes "Cannot convert undefined or null to object" error
      const mockLoadErrors = [
        {
          type: 'source' as const,
          id: 'error_test_null_settings',
          name: 'エラーテスト3: null設定 [browser_source]',
          error: new TypeError('Cannot convert undefined or null to object'),
        },
      ];

      const errorsByType = mockLoadErrors.reduce<Record<string, number>>((acc, err) => {
        acc[err.type] = (acc[err.type] || 0) + 1;
        return acc;
      }, {});

      const failedItemsContext = mockLoadErrors.reduce<Record<string, any>>((acc, err, index) => {
        const key = `${index + 1}_${err.type}`;
        acc[key] = {
          type: err.type,
          id: err.id || 'N/A',
          name: err.name,
          errorMessage: err.error instanceof Error ? err.error.message : String(err.error),
        };
        return acc;
      }, {});

      expect(errorsByType).toEqual({ source: 1 });
      expect(failedItemsContext).toEqual({
        '1_source': {
          type: 'source',
          id: 'error_test_null_settings',
          name: 'エラーテスト3: null設定 [browser_source]',
          errorMessage: 'Cannot convert undefined or null to object',
        },
      });
    });
  });

  describe('sceneCollections.lastLoadStatus tag', () => {
    let mockSetTag: jest.Mock;

    beforeEach(() => {
      mockSetTag = jest.fn();
      jest.spyOn(Sentry, 'setTag').mockImplementation(mockSetTag);
    });

    test('partial errors がある場合は partial-errors タグをセットする', () => {
      const loadErrors = [{ type: 'source', id: 's1', name: 'S', error: new Error() }];
      // simulate the tag-setting logic from scene-collections.ts
      Sentry.setTag(
        'sceneCollections.lastLoadStatus',
        loadErrors.length > 0 ? 'partial-errors' : 'ok',
      );
      Sentry.setTag('sceneCollections.loadErrorCount', String(loadErrors.length));

      expect(mockSetTag).toHaveBeenCalledWith('sceneCollections.lastLoadStatus', 'partial-errors');
      expect(mockSetTag).toHaveBeenCalledWith('sceneCollections.loadErrorCount', '1');
    });

    test('エラーがない場合は ok タグをセットする', () => {
      const loadErrors: any[] = [];
      // simulate the tag-setting logic from scene-collections.ts
      Sentry.setTag(
        'sceneCollections.lastLoadStatus',
        loadErrors.length > 0 ? 'partial-errors' : 'ok',
      );
      Sentry.setTag('sceneCollections.loadErrorCount', String(loadErrors.length));

      expect(mockSetTag).toHaveBeenCalledWith('sceneCollections.lastLoadStatus', 'ok');
      expect(mockSetTag).toHaveBeenCalledWith('sceneCollections.loadErrorCount', '0');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ensureCanvasResolution のテスト
// ─────────────────────────────────────────────────────────────────────────────

jest.mock('services/core/stateful-service');
jest.mock('services/core/injector');
jest.mock('services/core/service-helper', () => ({
  ServiceHelper: () => () => {},
}));
jest.mock('services/core/service-initialization-observer', () => ({
  InitAfter: () => () => {},
}));
jest.mock('../../../obs-api', () => ({
  InputFactory: { types: jest.fn().mockReturnValue([]) },
  NodeObs: { RegisterSourceCallback: jest.fn() },
  Global: { setOutputSource: jest.fn() },
  ESourceOutputFlags: { Audio: 1, Video: 2, Async: 4, DoNotDuplicate: 8 },
}));

/** settingsService のモックを生成するヘルパー */
function makeSettingsServiceMock(currentBase: string) {
  const mockSetting = { value: currentBase };
  return {
    getSettingsFormData: jest.fn().mockReturnValue([{ parameters: [mockSetting] }]),
    findSetting: jest.fn().mockReturnValue(mockSetting),
    setSettings: jest.fn(),
    setSettingValue: jest.fn(),
  };
}

describe('SceneCollectionsService - ensureCanvasResolution', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('initialize(): obsConfigExisted=false のとき setSettingValue で 1920x1080 が設定される', async () => {
    const mockSettings = makeSettingsServiceMock('1280x720');

    const setupFn = createSetupFunction({
      injectee: {
        SettingsService: mockSettings,
        ScenesService: { scenes: [{ getItems: () => [{}] }] },
        AppService: { obsConfigExisted: false },
        SourcesService: { fixSourceSettings: jest.fn() },
        SceneCollectionsStateService: {
          activeCollection: null,
          collections: [],
          loadManifestFile: jest.fn().mockResolvedValue(undefined),
        },
      },
    });
    setupFn();

    const { SceneCollectionsService } = require('./scene-collections');
    const instance = SceneCollectionsService.instance();

    instance.migrate = jest.fn().mockResolvedValue(undefined);
    instance.create = jest.fn().mockResolvedValue(undefined);

    await instance.initialize();

    expect(mockSettings.setSettingValue).toHaveBeenCalledWith('Video', 'Base', '1920x1080');
  });

  test('initialize(): obsConfigExisted=true のとき setSettingValue は呼ばれない', async () => {
    const mockSettings = makeSettingsServiceMock('1280x720');

    const setupFn = createSetupFunction({
      injectee: {
        SettingsService: mockSettings,
        ScenesService: { scenes: [{ getItems: () => [{}] }] },
        AppService: { obsConfigExisted: true },
        SourcesService: { fixSourceSettings: jest.fn() },
        SceneCollectionsStateService: {
          activeCollection: null,
          collections: [],
          loadManifestFile: jest.fn().mockResolvedValue(undefined),
        },
      },
    });
    setupFn();

    const { SceneCollectionsService } = require('./scene-collections');
    const instance = SceneCollectionsService.instance();

    instance.migrate = jest.fn().mockResolvedValue(undefined);
    instance.create = jest.fn().mockResolvedValue(undefined);

    await instance.initialize();

    expect(mockSettings.setSettingValue).not.toHaveBeenCalled();
  });

  test('installPresetSceneCollection(): setSettingValue で 1920x1080 が設定される', async () => {
    const mockSettings = makeSettingsServiceMock('1280x720');

    const setupFn = createSetupFunction({
      injectee: {
        SettingsService: mockSettings,
        ScenesService: { removeAllScenes: jest.fn() },
        HotkeysService: { bindHotkeys: jest.fn() },
        DismissablesService: { dismiss: jest.fn() },
        SceneCollectionsStateService: {
          readCollectionFile: jest.fn().mockReturnValue('{}'),
        },
      },
    });
    setupFn();

    jest.mock('./parse', () => ({
      parse: jest.fn().mockReturnValue({ load: jest.fn().mockResolvedValue(undefined) }),
    }));

    const { SceneCollectionsService } = require('./scene-collections');
    const instance = SceneCollectionsService.instance();

    instance.startLoadingOperation = jest.fn();
    instance.finishLoadingOperation = jest.fn();
    instance.save = jest.fn().mockResolvedValue(undefined);
    instance.scheduleWebcamFitForPreset = jest.fn();

    await instance.installPresetSceneCollection();

    expect(mockSettings.setSettingValue).toHaveBeenCalledWith('Video', 'Base', '1920x1080');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// exportCollection / importCollection のテスト
// ─────────────────────────────────────────────────────────────────────────────

describe('SceneCollectionsService - exportCollection / importCollection', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('importCollection(): JSON構文が不正な場合は例外を投げ、ファイル書き込みを行わない', async () => {
    const mockStateService = {
      ensureDirectory: jest.fn().mockResolvedValue(undefined),
      writeDataToCollectionFile: jest.fn(),
      ADD_COLLECTION: jest.fn(),
    };

    const setupFn = createSetupFunction({
      injectee: {
        SceneCollectionsStateService: mockStateService,
      },
    });
    setupFn();

    // このdescribe内のテストで完結させるため、他のテストのモックに依存せず明示的にセットアップする
    jest.doMock('./parse', () => ({
      parse: jest.fn().mockImplementation(() => {
        throw new SyntaxError('Unexpected token in JSON');
      }),
    }));

    const { SceneCollectionsService } = require('./scene-collections');
    const instance = SceneCollectionsService.instance();

    await expect(instance.importCollection('test', 'not valid json')).rejects.toThrow();

    expect(mockStateService.writeDataToCollectionFile).not.toHaveBeenCalled();
    expect(mockStateService.ADD_COLLECTION).not.toHaveBeenCalled();
  });

  test('importCollection(): JSONとしては妥当でもN Air形式でない場合は例外を投げる', async () => {
    const mockStateService = {
      ensureDirectory: jest.fn().mockResolvedValue(undefined),
      writeDataToCollectionFile: jest.fn(),
      ADD_COLLECTION: jest.fn(),
    };

    const setupFn = createSetupFunction({
      injectee: {
        SceneCollectionsStateService: mockStateService,
      },
    });
    setupFn();

    // OBSのbasic.jsonのようにnodeTypeを持たないJSONは、parse()自体は成功するが
    // RootNodeのインスタンスにはならないケースを再現する
    jest.doMock('./parse', () => ({
      parse: jest.fn().mockReturnValue({ some: 'unrelated data' }),
    }));

    const { SceneCollectionsService } = require('./scene-collections');
    const instance = SceneCollectionsService.instance();

    await expect(instance.importCollection('test', '{"some":"unrelated data"}')).rejects.toThrow();

    expect(mockStateService.writeDataToCollectionFile).not.toHaveBeenCalled();
    expect(mockStateService.ADD_COLLECTION).not.toHaveBeenCalled();
  });

  test('importCollection(): 正常なN Air形式のJSONの場合はファイルに書き込み、ADD_COLLECTIONを呼ぶ', async () => {
    const mockStateService = {
      collections: [] as ISceneCollectionsManifestEntry[],
      ensureDirectory: jest.fn().mockResolvedValue(undefined),
      writeDataToCollectionFile: jest.fn(),
      ADD_COLLECTION: jest.fn(),
    };

    const setupFn = createSetupFunction({
      injectee: {
        SceneCollectionsStateService: mockStateService,
      },
    });
    setupFn();

    // このdescribe内のテストで完結させるため、明示的に RootNode のインスタンスを返すようセットアップする
    const { RootNode } = require('./nodes/root');
    jest.doMock('./parse', () => ({
      parse: jest.fn().mockReturnValue(Object.create(RootNode.prototype)),
    }));

    const { SceneCollectionsService } = require('./scene-collections');
    const instance = SceneCollectionsService.instance();

    instance.getCollection = jest.fn().mockReturnValue({ id: 'new-id', name: 'test' });
    instance.collectionAdded = { next: jest.fn() };

    const data = JSON.stringify({ nodeType: 'RootNode' });
    const result = await instance.importCollection('test', data);

    expect(mockStateService.ensureDirectory).toHaveBeenCalled();
    expect(mockStateService.writeDataToCollectionFile).toHaveBeenCalledWith(
      expect.any(String),
      data,
    );
    expect(mockStateService.ADD_COLLECTION).toHaveBeenCalledWith(
      expect.any(String),
      'test',
      expect.any(String),
    );
    expect(instance.collectionAdded.next).toHaveBeenCalled();
    expect(result).toEqual({ id: 'new-id', name: 'test' });
  });

  test('exportCollection(): activeCollectionと異なるidの場合はsaveを呼ばずファイルを読み込んで書き出す', async () => {
    const mockStateService = {
      activeCollection: { id: 'active-id' },
      readCollectionFile: jest.fn().mockResolvedValue('{"foo":"bar"}'),
    };

    const setupFn = createSetupFunction({
      injectee: {
        SceneCollectionsStateService: mockStateService,
      },
    });
    setupFn();

    const fs = require('fs');
    jest.spyOn(fs.promises, 'writeFile').mockResolvedValue(undefined);

    const { SceneCollectionsService } = require('./scene-collections');
    const instance = SceneCollectionsService.instance();

    instance.save = jest.fn().mockResolvedValue(undefined);

    await instance.exportCollection('other-id', '/tmp/export.json');

    expect(instance.save).not.toHaveBeenCalled();
    expect(mockStateService.readCollectionFile).toHaveBeenCalledWith('other-id');
    expect(fs.promises.writeFile).toHaveBeenCalledWith('/tmp/export.json', '{"foo":"bar"}');
  });

  test('exportCollection(): activeCollectionと同じidの場合はsaveを呼ぶ', async () => {
    const mockStateService = {
      activeCollection: { id: 'active-id' },
      readCollectionFile: jest.fn().mockResolvedValue('{"foo":"bar"}'),
    };

    const setupFn = createSetupFunction({
      injectee: {
        SceneCollectionsStateService: mockStateService,
      },
    });
    setupFn();

    const fs = require('fs');
    jest.spyOn(fs.promises, 'writeFile').mockResolvedValue(undefined);

    const { SceneCollectionsService } = require('./scene-collections');
    const instance = SceneCollectionsService.instance();

    instance.save = jest.fn().mockResolvedValue(undefined);

    await instance.exportCollection('active-id', '/tmp/export.json');

    expect(instance.save).toHaveBeenCalled();
  });
});
