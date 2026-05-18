import { TransitionsNode } from './transitions';

jest.mock('electron', () => ({}));
jest.mock('@electron/remote', () => ({}));
jest.mock('services/core/injector', () => ({
  Inject: () => () => {},
}));
jest.mock('services/transitions', () => ({
  ETransitionType: {
    Cut: 'cut_transition',
    Fade: 'fade_transition',
    Swipe: 'swipe_transition',
    Slide: 'slide_transition',
    FadeToColor: 'fade_to_color_transition',
    LumaWipe: 'wipe_transition',
    Stinger: 'obs_stinger_transition',
    Motion: 'motion_transition',
  },
  TransitionsService: class {},
}));
jest.mock('components/obs/inputs/ObsInput', () => ({}));
jest.mock('@sentry/vue', () => ({
  withScope: jest.fn(),
}));

function createMockService(transitionOverrides: any[] = []) {
  return {
    state: {
      transitions: transitionOverrides,
      connections: [] as any[],
      defaultTransitionId: transitionOverrides[0]?.id ?? null,
    },
    getSettings: jest.fn().mockReturnValue({}),
    getPropertiesManagerSettings: jest.fn().mockReturnValue({}),
    deleteAllTransitions: jest.fn(),
    createTransition: jest.fn(),
    deleteAllConnections: jest.fn(),
    addConnection: jest.fn(),
    setDefaultTransition: jest.fn(),
  };
}

function createNode(mockService: ReturnType<typeof createMockService>) {
  const node = new TransitionsNode();
  (node as any).transitionsService = mockService;
  return node;
}

describe('TransitionsNode save()', () => {
  test('レガシー型(Cut)はそのまま type フィールドに保存し typeV2 は付けない', async () => {
    const service = createMockService([
      { id: 'id1', name: 'Global Transition', type: 'cut_transition', duration: 300 },
    ]);
    const node = createNode(service);

    await node.save();

    const saved = (node as any).data.transitions[0];
    expect(saved.type).toBe('cut_transition');
    expect(saved.typeV2).toBeUndefined();
  });

  test('レガシー型(Fade)はそのまま type フィールドに保存し typeV2 は付けない', async () => {
    const service = createMockService([
      { id: 'id1', name: 'Fade', type: 'fade_transition', duration: 500 },
    ]);
    const node = createNode(service);

    await node.save();

    const saved = (node as any).data.transitions[0];
    expect(saved.type).toBe('fade_transition');
    expect(saved.typeV2).toBeUndefined();
  });

  test('非レガシー型(Motion)は type=cut、typeV2=motion_transition で保存する', async () => {
    const service = createMockService([
      { id: 'id1', name: 'Motion', type: 'motion_transition', duration: 300 },
    ]);
    const node = createNode(service);

    await node.save();

    const saved = (node as any).data.transitions[0];
    expect(saved.type).toBe('cut_transition');
    expect(saved.typeV2).toBe('motion_transition');
  });

  test('複数 transition が混在するとき各々が正しく分類される', async () => {
    const service = createMockService([
      { id: 'id1', name: 'Cut', type: 'cut_transition', duration: 300 },
      { id: 'id2', name: 'Motion', type: 'motion_transition', duration: 500 },
      { id: 'id3', name: 'Fade', type: 'fade_transition', duration: 400 },
    ]);
    const node = createNode(service);

    await node.save();

    const saved = (node as any).data.transitions;
    expect(saved[0].type).toBe('cut_transition');
    expect(saved[0].typeV2).toBeUndefined();
    expect(saved[1].type).toBe('cut_transition');
    expect(saved[1].typeV2).toBe('motion_transition');
    expect(saved[2].type).toBe('fade_transition');
    expect(saved[2].typeV2).toBeUndefined();
  });
});

describe('TransitionsNode load()', () => {
  test('typeV2 なしのデータは type フィールドの値で createTransition する', async () => {
    const service = createMockService();
    const node = createNode(service);
    (node as any).data = {
      transitions: [{ id: 'id1', name: 'Fade', type: 'fade_transition', duration: 500, settings: {} }],
      connections: [],
      defaultTransitionId: 'id1',
    };

    await node.load();

    expect(service.createTransition).toHaveBeenCalledWith(
      'fade_transition',
      'Fade',
      expect.objectContaining({ id: 'id1', duration: 500 }),
    );
  });

  test('typeV2 があるデータは typeV2 の値で createTransition する', async () => {
    const service = createMockService();
    const node = createNode(service);
    (node as any).data = {
      transitions: [
        {
          id: 'id1',
          name: 'Motion',
          type: 'cut_transition',
          typeV2: 'motion_transition',
          duration: 300,
          settings: {},
        },
      ],
      connections: [],
      defaultTransitionId: 'id1',
    };

    await node.load();

    expect(service.createTransition).toHaveBeenCalledWith(
      'motion_transition',
      'Motion',
      expect.objectContaining({ id: 'id1', duration: 300 }),
    );
  });

  test('typeV2 が将来の未知型のとき createTransition にそのまま渡す(service 側でフォールバック)', async () => {
    // createTransition 内の静的 enum フォールバックが Cut に落とす。
    // このテストは node が typeV2 をそのまま渡すことを保証する。
    const service = createMockService();
    const node = createNode(service);
    (node as any).data = {
      transitions: [
        {
          id: 'id1',
          name: 'Future',
          type: 'cut_transition',
          typeV2: 'future_unknown_transition',
          duration: 300,
          settings: {},
        },
      ],
      connections: [],
      defaultTransitionId: 'id1',
    };

    await node.load();

    expect(service.createTransition).toHaveBeenCalledWith(
      'future_unknown_transition',
      'Future',
      expect.any(Object),
    );
  });

  test('save → load の round-trip で Motion 型が復元される', async () => {
    const service = createMockService([
      { id: 'id1', name: 'Motion', type: 'motion_transition', duration: 300 },
    ]);
    const node = createNode(service);

    await node.save();

    // save 後のデータを別ノードで load
    const node2 = createNode(createMockService());
    (node2 as any).data = (node as any).data;
    const service2 = (node2 as any).transitionsService;

    await node2.load();

    expect(service2.createTransition).toHaveBeenCalledWith(
      'motion_transition',
      'Motion',
      expect.objectContaining({ id: 'id1', duration: 300 }),
    );
  });
});
