import { CURRENT_FORMAT_VERSION, NAIR_SCENE_COLLECTION_FORMAT_ID, RootNode } from './root';

jest.mock('electron', () => ({}));
jest.mock('@electron/remote', () => ({}));
jest.mock('services/core/injector', () => ({
  Inject: () => () => {},
}));
jest.mock('services/scenes', () => ({ ScenesService: class {} }));
jest.mock('services/settings-v2/video', () => ({ VideoSettingsService: class {} }));
jest.mock('services/video', () => ({ VideoService: class {} }));

function createNode(overrides: {
  videoService?: any;
  videoSettingsService?: any;
  scenesService?: any;
}) {
  const node = new RootNode();
  (node as any).videoService = overrides.videoService ?? {
    baseResolution: { width: 1920, height: 1080 },
    setBaseResolution: jest.fn(),
  };
  (node as any).videoSettingsService = overrides.videoSettingsService ?? {
    baseResolutions: { horizontal: { baseWidth: 1920, baseHeight: 1080 } },
  };
  (node as any).scenesService = overrides.scenesService ?? { rescaleAllScenes: jest.fn() };
  return node;
}

function stubChildNodes(node: RootNode, dataOverrides: Partial<RootNode['data']> = {}) {
  node.data = {
    sources: {
      load: jest.fn().mockResolvedValue(undefined),
      getLoadErrors: jest.fn((): any[] => []),
    },
    scenes: {
      load: jest.fn().mockResolvedValue(undefined),
      getLoadErrors: jest.fn((): any[] => []),
    },
    transitions: {
      load: jest.fn().mockResolvedValue(undefined),
      getLoadErrors: jest.fn((): any[] => []),
    },
    hotkeys: undefined,
    ...dataOverrides,
  } as any;
}

describe('RootNode.save()', () => {
  test('formatId / formatVersion / baseResolution を書き込む', async () => {
    const videoService = {
      baseResolution: { width: 1280, height: 720 },
    };
    const node = createNode({ videoService });

    // Avoid depending on the real Sources/Scenes/Transitions/Hotkeys node
    // classes (which pull in obs-studio-node etc.) by stubbing their save().
    const stub = { save: jest.fn().mockResolvedValue(undefined) };
    jest.spyOn(require('./sources'), 'SourcesNode').mockImplementation(() => stub as any);
    jest.spyOn(require('./scenes'), 'ScenesNode').mockImplementation(() => stub as any);
    jest.spyOn(require('./transitions'), 'TransitionsNode').mockImplementation(() => stub as any);
    jest.spyOn(require('./hotkeys'), 'HotkeysNode').mockImplementation(() => stub as any);

    await node.save();

    expect(node.data.formatId).toBe(NAIR_SCENE_COLLECTION_FORMAT_ID);
    expect(node.data.formatVersion).toBe(CURRENT_FORMAT_VERSION);
    expect(node.data.baseResolution).toEqual({ width: 1280, height: 720 });
  });
});

describe('RootNode.load() - forward compatibility & rescale', () => {
  test('保存解像度と現在の解像度が異なる場合、現在の解像度を維持しrescaleAllScenesを呼ぶ', async () => {
    const videoService = {
      baseResolution: { width: 1920, height: 1080 },
      setBaseResolution: jest.fn(),
    };
    const videoSettingsService = {
      baseResolutions: { horizontal: { baseWidth: 1920, baseHeight: 1080 } },
    };
    const scenesService = { rescaleAllScenes: jest.fn() };
    const node = createNode({ videoService, videoSettingsService, scenesService });

    stubChildNodes(node, {
      formatId: NAIR_SCENE_COLLECTION_FORMAT_ID,
      formatVersion: CURRENT_FORMAT_VERSION,
      baseResolution: { width: 1280, height: 720 },
    } as any);

    await node.load();

    // Canvas is set to the *current* resolution, not the saved one
    expect(videoService.setBaseResolution).toHaveBeenCalledWith({ width: 1920, height: 1080 });
    // Items are rescaled by target/saved
    expect(scenesService.rescaleAllScenes).toHaveBeenCalledWith(1920 / 1280, 1080 / 720);
    expect(node.getLoadErrors()).toEqual([]);
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

    stubChildNodes(node, { baseResolution: { width: 1920, height: 1080 } } as any);

    await node.load();

    expect(scenesService.rescaleAllScenes).not.toHaveBeenCalled();
  });

  test('formatVersionが現在のCURRENT_FORMAT_VERSIONより大きい場合はformat警告を追加するが読み込みは継続する', async () => {
    const node = createNode({});

    stubChildNodes(node, { formatVersion: CURRENT_FORMAT_VERSION + 1 } as any);

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

    stubChildNodes(node, { baseResolution: { width: 1280, height: 720 } } as any);

    await expect(node.load()).resolves.toBeUndefined();

    const errors = node.getLoadErrors();
    expect(errors).toHaveLength(1);
    expect(errors[0].type).toBe('format');
  });

  test('formatVersionが現在以下の場合はformat警告を追加しない', async () => {
    const node = createNode({});

    stubChildNodes(node, { formatVersion: CURRENT_FORMAT_VERSION } as any);

    await node.load();

    expect(node.getLoadErrors()).toEqual([]);
  });

  test('子ノードのload失敗はtypeごとのILoadErrorとして蓄積される（既存挙動の回帰確認）', async () => {
    const node = createNode({});

    stubChildNodes(node, {
      sources: {
        load: jest.fn().mockRejectedValue(new Error('sources boom')),
        getLoadErrors: jest.fn((): any[] => []),
      },
    } as any);

    await node.load();

    const errors = node.getLoadErrors();
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ type: 'source', name: 'Sources' });
  });
});

describe('RootNode.migrate()', () => {
  test('version<=2 のファイルはformatId/formatVersionを補完し、baseResolutionは補完しない', () => {
    const node = createNode({});
    node.data = { transitions: {} } as any;

    node.migrate(2);

    expect(node.data.formatId).toBe(NAIR_SCENE_COLLECTION_FORMAT_ID);
    expect(node.data.formatVersion).toBe(CURRENT_FORMAT_VERSION);
    expect(node.data.baseResolution).toBeUndefined();
  });

  test('version===1 は旧transitionフィールドをtransitionsへリネームしつつformatメタも補完する', () => {
    const node = createNode({});
    const legacyTransition = { schemaVersion: 1 };
    node.data = { transition: legacyTransition } as any;

    node.migrate(1);

    expect((node.data as any).transitions).toBe(legacyTransition);
    expect(node.data.formatId).toBe(NAIR_SCENE_COLLECTION_FORMAT_ID);
    expect(node.data.formatVersion).toBe(CURRENT_FORMAT_VERSION);
  });

  test('既にformatId/formatVersionを持つ場合は上書きしない', () => {
    const node = createNode({});
    node.data = { formatId: 'custom', formatVersion: 42 } as any;

    node.migrate(2);

    expect(node.data.formatId).toBe('custom');
    expect(node.data.formatVersion).toBe(42);
  });
});
