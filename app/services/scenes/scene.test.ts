/** @jest-environment jsdom */

/**
 * Scene.reconcileNodeOrderWithObs (moveNodes経由) のテスト
 *
 * ドラッグ操作中の削除・シーン切替との競合などでVuex state上のアイテムと
 * OBSネイティブ側のアイテム集合が一時的にズレたとき、対応するOBS側アイテムが
 * 見つからないアイテムはスキップして処理を継続することを検証する (N-AIR-APP-FWY, G8M)。
 */
import { createSetupFunction } from 'util/test-setup';

jest.mock('@sentry/vue', () => ({
  captureMessage: jest.fn(),
  withScope: jest.fn((cb) => cb({
    setLevel: jest.fn(),
    setTag: jest.fn(),
    setFingerprint: jest.fn(),
    setExtra: jest.fn(),
    setContext: jest.fn(),
  })),
}));

jest.mock('util/sentry-obs-breadcrumb', () => ({
  markObsOp: jest.fn(),
  setObsOpObserver: jest.fn(),
  getLastObsOp: jest.fn(),
  assertObsObjectDefined: jest.fn(),
}));

jest.mock('services/core/stateful-service');
jest.mock('services/core/injector');
jest.mock('services/core/service-helper', () => ({
  ServiceHelper: () => () => {},
}));

const setup = createSetupFunction();

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
});

function makeObsScene(items: { id: number }[]) {
  return {
    getItems: jest.fn(() => [...items]),
    moveItem: jest.fn(),
  };
}

function prepare({
  itemIds,
  obsItemIds,
}: {
  itemIds: { sceneItemId: string; sourceId: string; obsSceneItemId: number }[];
  obsItemIds: number[];
}) {
  const sceneId = 'scene1';
  const nodes = itemIds.map(({ sceneItemId, sourceId, obsSceneItemId }) => ({
    id: sceneItemId,
    sceneNodeType: 'item' as const,
    sourceId,
    obsSceneItemId,
  }));

  const sources: Record<string, unknown> = {};
  itemIds.forEach(({ sourceId }) => {
    sources[sourceId] = { sourceId };
  });

  const obsScene = makeObsScene(obsItemIds.map((id) => ({ id })));

  setup({
    injectee: {
      ScenesService: {
        state: {
          scenes: {
            [sceneId]: { id: sceneId, nodes },
          },
        },
        getScene: jest.fn(),
      },
      SourcesService: {
        state: { sources },
      },
      SelectionService: {},
      VideoSettingsService: {},
      VideoService: {},
    },
  });

  const { Scene } = require('./scene') as { Scene: new (id: string) => any };
  const scene = new Scene(sceneId);
  jest.spyOn(scene, 'getObsScene').mockReturnValue(obsScene);

  const Sentry = require('@sentry/vue');

  return { scene, obsScene, Sentry };
}

describe('Scene.reconcileNodeOrderWithObs (via moveNodes)', () => {
  test('全アイテムに対応するOBS側アイテムがある場合、すべてmoveItemされる', () => {
    const { scene, obsScene } = prepare({
      itemIds: [
        { sceneItemId: 'item1', sourceId: 'source1', obsSceneItemId: 1 },
        { sceneItemId: 'item2', sourceId: 'source2', obsSceneItemId: 2 },
      ],
      obsItemIds: [2, 1],
    });

    expect(() => scene.moveNodes(['item1'], '', 'item2')).not.toThrow();
    expect(obsScene.moveItem).toHaveBeenCalledTimes(2);
  });

  test('対応するOBS側アイテムが見つからないアイテムはスキップし、他のアイテムは処理を継続する', () => {
    const { scene, obsScene, Sentry } = prepare({
      itemIds: [
        { sceneItemId: 'item1', sourceId: 'source1', obsSceneItemId: 1 },
        { sceneItemId: 'item2', sourceId: 'source2', obsSceneItemId: 999 }, // OBS側に存在しない
      ],
      obsItemIds: [1],
    });

    expect(() => scene.moveNodes(['item1'], '', 'item2')).not.toThrow();
    // item1のみmoveItemが呼ばれる (item2はスキップ)
    expect(obsScene.moveItem).toHaveBeenCalledTimes(1);
    expect(obsScene.moveItem).toHaveBeenCalledWith(0, 0);
    // スキップしたことがSentryに報告される
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      'OBS scene item not found for obsSceneItemId, skipping moveItem',
    );
  });

  test('対応するOBS側アイテムが1件も見つからない場合でもクラッシュしない', () => {
    const { scene, obsScene } = prepare({
      itemIds: [
        { sceneItemId: 'item1', sourceId: 'source1', obsSceneItemId: 1 },
      ],
      obsItemIds: [],
    });

    expect(() => scene.moveNodes(['item1'])).not.toThrow();
    expect(obsScene.moveItem).not.toHaveBeenCalled();
  });
});
