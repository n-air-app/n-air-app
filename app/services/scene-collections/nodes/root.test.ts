import { ILoadError } from './node';
import { CURRENT_FORMAT_VERSION, NAIR_SCENE_COLLECTION_FORMAT_ID, RootNode } from './root';
import { ScenesNode } from './scenes';
import { SourcesNode } from './sources';
import { TransitionsNode } from './transitions';

jest.mock('electron', () => ({}));
jest.mock('@electron/remote', () => ({}));
jest.mock('services/core/injector', () => ({
  Inject: () => () => {},
}));
jest.mock('services/scenes', () => ({ ScenesService: class {} }));
jest.mock('services/settings-v2/video', () => ({ VideoSettingsService: class {} }));
jest.mock('services/video', () => ({ VideoService: class {} }));

// Minimal shape of each injected service RootNode actually calls, so tests
// don't need to depend on the real (heavy, OBS-backed) implementations.
type IVideoServiceStub = Pick<RootNode['videoService'], 'baseResolution' | 'setBaseResolution'>;
type IVideoSettingsServiceStub = {
  baseResolutions: RootNode['videoSettingsService']['baseResolutions'];
  contexts: {
    horizontal: {
      video: {
        baseWidth: number;
        baseHeight: number;
      };
    } | null;
  };
};
type IScenesServiceStub = Pick<RootNode['scenesService'], 'rescaleAllScenes'>;

function createNode(overrides: {
  videoService?: Partial<IVideoServiceStub>;
  videoSettingsService?: Partial<IVideoSettingsServiceStub>;
  scenesService?: Partial<IScenesServiceStub>;
}) {
  const node = new RootNode();
  node.videoService = {
    baseResolution: { width: 1920, height: 1080 },
    setBaseResolution: jest.fn(),
    ...overrides.videoService,
  } as RootNode['videoService'];
  node.videoSettingsService = {
    baseResolutions: { horizontal: { baseWidth: 1920, baseHeight: 1080 } },
    contexts: {
      horizontal: {
        video: {
          baseWidth: 1920,
          baseHeight: 1080,
        },
      },
    },
    ...overrides.videoSettingsService,
  } as RootNode['videoSettingsService'];
  node.scenesService = {
    rescaleAllScenes: jest.fn(),
    ...overrides.scenesService,
  } as RootNode['scenesService'];
  return node;
}

// Minimal shape of a child node RootNode.load() interacts with: it only
// calls load() and getLoadErrors() on each of them.
interface IChildNodeStub {
  load: jest.Mock<Promise<void>, any[]>;
  getLoadErrors: jest.Mock<ILoadError[], []>;
}

function makeChildNodeStub(): IChildNodeStub {
  return {
    load: jest.fn().mockResolvedValue(undefined),
    getLoadErrors: jest.fn((): ILoadError[] => []),
  };
}

function stubChildNodes(
  node: RootNode,
  dataOverrides: Omit<Partial<RootNode['data']>, 'sources'> & { sources?: IChildNodeStub } = {},
) {
  const { sources: sourcesOverride, ...rest } = dataOverrides;
  node.data = {
    sources: (sourcesOverride ?? makeChildNodeStub()) as unknown as SourcesNode,
    scenes: makeChildNodeStub() as unknown as ScenesNode,
    transitions: makeChildNodeStub() as unknown as TransitionsNode,
    hotkeys: undefined,
    ...rest,
  } as RootNode['data'];
}

describe('RootNode.save()', () => {
  test('formatId / formatVersion / baseResolution を書き込む', async () => {
    const videoService = {
      baseResolution: { width: 1280, height: 720 },
    };
    const node = createNode({ videoService });

    // Avoid depending on the real Sources/Scenes/Transitions/Hotkeys node
    // classes (which pull in obs-studio-node etc.) by stubbing their save().
    const save = jest.fn().mockResolvedValue(undefined);
    jest.spyOn(require('./sources'), 'SourcesNode')
      .mockImplementation(() => ({ save }) as unknown as SourcesNode);
    jest.spyOn(require('./scenes'), 'ScenesNode')
      .mockImplementation(() => ({ save }) as unknown as ScenesNode);
    jest.spyOn(require('./transitions'), 'TransitionsNode')
      .mockImplementation(() => ({ save }) as unknown as TransitionsNode);
    jest.spyOn(require('./hotkeys'), 'HotkeysNode')
      .mockImplementation(() => ({ save }) as unknown as import('./hotkeys').HotkeysNode);

    await node.save();

    expect(node.data.formatId).toBe(NAIR_SCENE_COLLECTION_FORMAT_ID);
    expect(node.data.formatVersion).toBe(CURRENT_FORMAT_VERSION);
    expect(node.data.baseResolution).toEqual({ width: 1280, height: 720 });
  });
});

describe('RootNode.load() - forward compatibility & rescale', () => {
  test('保存解像度と現在の解像度が異なる場合、現在の解像度を維持しrescaleAllScenesを呼ぶ', async () => {
    const videoService = {
      baseResolution: { width: 1280, height: 720 },
      setBaseResolution: jest.fn(),
    };
    const videoSettingsService = {
      baseResolutions: { horizontal: { baseWidth: 1920, baseHeight: 1080 } },
      contexts: {
        horizontal: {
          video: { baseWidth: 1280, baseHeight: 720 },
        },
      },
    };
    const scenesService = { rescaleAllScenes: jest.fn() };
    const node = createNode({ videoService, videoSettingsService, scenesService });

    stubChildNodes(node, {
      formatId: NAIR_SCENE_COLLECTION_FORMAT_ID,
      formatVersion: CURRENT_FORMAT_VERSION,
      baseResolution: { width: 1280, height: 720 },
    });

    await node.load();

    // Canvas is set to the *current* resolution, not the saved one
    expect(videoService.setBaseResolution).toHaveBeenCalledWith({ width: 1920, height: 1080 });
    // Items are rescaled by target/saved
    expect(scenesService.rescaleAllScenes).toHaveBeenCalledWith(1920 / 1280, 1080 / 720);
    expect(node.getLoadErrors()).toEqual([]);
  });

  test('OBS video contextの解像度が現在の設定と同一の場合は再設定しない', async () => {
    const videoService = {
      // VideoService.baseResolution は設定値由来であり、OBS実値の比較には使わない。
      baseResolution: { width: 1280, height: 720 },
      setBaseResolution: jest.fn(),
    };
    const videoSettingsService = {
      baseResolutions: { horizontal: { baseWidth: 1920, baseHeight: 1080 } },
      contexts: {
        horizontal: {
          video: { baseWidth: 1920, baseHeight: 1080 },
        },
      },
    };
    const node = createNode({ videoService, videoSettingsService });

    stubChildNodes(node);

    await node.load();

    expect(videoService.setBaseResolution).not.toHaveBeenCalled();
  });

  test('保存解像度が無い（旧フォーマット）場合はrescaleAllScenesを呼ばない', async () => {
    const scenesService = { rescaleAllScenes: jest.fn() };
    const node = createNode({ scenesService });

    stubChildNodes(node); // no baseResolution field at all

    await node.load();

    expect(scenesService.rescaleAllScenes).not.toHaveBeenCalled();
  });

  test('保存解像度と現在の解像度が同一の場合はrescaleAllScenesを呼ばない', async () => {
    const videoSettingsService = {
      baseResolutions: { horizontal: { baseWidth: 1920, baseHeight: 1080 } },
    };
    const scenesService = { rescaleAllScenes: jest.fn() };
    const node = createNode({ videoSettingsService, scenesService });

    stubChildNodes(node, { baseResolution: { width: 1920, height: 1080 } });

    await node.load();

    expect(node.videoService.setBaseResolution).not.toHaveBeenCalled();
    expect(scenesService.rescaleAllScenes).not.toHaveBeenCalled();
  });

  test('formatVersionが現在のCURRENT_FORMAT_VERSIONより大きい場合はformat警告を追加するが読み込みは継続する', async () => {
    const node = createNode({});

    stubChildNodes(node, { formatVersion: CURRENT_FORMAT_VERSION + 1 });

    await node.load();

    const errors = node.getLoadErrors();
    expect(errors).toHaveLength(1);
    expect(errors[0].type).toBe('format');
    expect(node.data.sources.load).toHaveBeenCalled();
    expect(node.data.scenes.load).toHaveBeenCalled();
  });

  test('rescaleAllScenesが例外を投げた場合はformat警告として蓄積し、load()自体は失敗させない', async () => {
    const videoSettingsService = {
      baseResolutions: { horizontal: { baseWidth: 1920, baseHeight: 1080 } },
    };
    const scenesService = {
      rescaleAllScenes: jest.fn(() => {
        throw new Error('boom during rescale');
      }),
    };
    const node = createNode({ videoSettingsService, scenesService });

    stubChildNodes(node, { baseResolution: { width: 1280, height: 720 } });

    await expect(node.load()).resolves.toBeUndefined();

    const errors = node.getLoadErrors();
    expect(errors).toHaveLength(1);
    expect(errors[0].type).toBe('format');
  });

  test('formatVersionが現在以下の場合はformat警告を追加しない', async () => {
    const node = createNode({});

    stubChildNodes(node, { formatVersion: CURRENT_FORMAT_VERSION });

    await node.load();

    expect(node.getLoadErrors()).toEqual([]);
  });

  test('子ノードのload失敗はtypeごとのILoadErrorとして蓄積される（既存挙動の回帰確認）', async () => {
    const node = createNode({});

    stubChildNodes(node, {
      sources: {
        load: jest.fn().mockRejectedValue(new Error('sources boom')),
        getLoadErrors: jest.fn((): ILoadError[] => []),
      },
    });

    await node.load();

    const errors = node.getLoadErrors();
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ type: 'source', name: 'Sources' });
  });
});

// RootNode.migrate() reads/writes this.data before it necessarily matches
// the current ISchema shape (that's the whole point of migrating an older
// file), including the legacy `transition` (singular) field that predates
// `transitions`. This type captures exactly that pre-migration shape.
type IPreMigrationData = Partial<RootNode['data']> & { transition?: unknown };

describe('RootNode.migrate()', () => {
  test('version<=2 のファイルはformatId/formatVersionを補完し、baseResolutionは補完しない', () => {
    const node = createNode({});
    node.data = { transitions: {} } as IPreMigrationData as RootNode['data'];

    node.migrate(2);

    expect(node.data.formatId).toBe(NAIR_SCENE_COLLECTION_FORMAT_ID);
    expect(node.data.formatVersion).toBe(CURRENT_FORMAT_VERSION);
    expect(node.data.baseResolution).toBeUndefined();
  });

  test('version===1 は旧transitionフィールドをtransitionsへリネームしつつformatメタも補完する', () => {
    const node = createNode({});
    const legacyTransition = { schemaVersion: 1 };
    node.data = { transition: legacyTransition } as IPreMigrationData as RootNode['data'];

    node.migrate(1);

    expect(node.data.transitions).toBe(legacyTransition);
    expect(node.data.formatId).toBe(NAIR_SCENE_COLLECTION_FORMAT_ID);
    expect(node.data.formatVersion).toBe(CURRENT_FORMAT_VERSION);
  });

  test('既にformatId/formatVersionを持つ場合は上書きしない', () => {
    const node = createNode({});
    node.data = {
      formatId: 'custom',
      formatVersion: 42,
    } as IPreMigrationData as RootNode['data'];

    node.migrate(2);

    expect(node.data.formatId).toBe('custom');
    expect(node.data.formatVersion).toBe(42);
  });
});
