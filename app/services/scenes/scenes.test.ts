/**
 * ScenesService.rescaleAllScenes のテスト
 *
 * キャンバス解像度(Base)変更時に既存シーンのレイアウトを保つため、
 * 全シーンの全アイテムの position/scale を倍率でスケールする処理を検証する。
 */
import { createSetupFunction } from 'util/test-setup';

jest.mock('@sentry/vue', () => ({
  addBreadcrumb: jest.fn(),
  setTag: jest.fn(),
}));

jest.mock('util/sentry-obs-breadcrumb', () => ({
  markObsOp: jest.fn(),
  setObsOpObserver: jest.fn(),
  getLastObsOp: jest.fn(),
  assertObsObjectDefined: jest.fn(),
}));

jest.mock('../../../obs-api', () => ({}));

jest.mock('services/core/stateful-service');
jest.mock('services/core/injector');
jest.mock('services/core/service-initialization-observer', () => ({
  InitAfter: () => () => {},
}));
jest.mock('services/core/service-helper', () => ({
  ServiceHelper: () => () => {},
}));

const setup = createSetupFunction({
  state: {
    ScenesService: {
      activeSceneId: '',
      displayOrder: [],
      scenes: {},
    },
  },
  injectee: {
    WindowsService: {},
    SourcesService: {},
    TransitionsService: {},
    RtvcStateService: {},
  },
});

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
});

describe('ScenesService.rescaleAllScenes', () => {
  test('全シーンの全アイテムの position/scale が倍率で更新され、crop/rotation は変わらない', () => {
    setup();

    const { ScenesService } = require('./scenes');
    const instance = ScenesService.instance();

    const item1 = {
      transform: {
        position: { x: 100, y: 50 },
        scale: { x: 1, y: 1 },
        crop: { top: 1, right: 2, bottom: 3, left: 4 },
        rotation: 90,
      },
      setTransform: jest.fn(),
    };
    const item2 = {
      transform: {
        position: { x: 0, y: 0 },
        scale: { x: 2, y: 0.5 },
        crop: { top: 0, right: 0, bottom: 0, left: 0 },
        rotation: 0,
      },
      setTransform: jest.fn(),
    };

    const scene1 = { getItems: jest.fn().mockReturnValue([item1]) };
    const scene2 = { getItems: jest.fn().mockReturnValue([item2]) };

    Object.defineProperty(instance, 'scenes', {
      value: [scene1, scene2],
      configurable: true,
    });

    instance.rescaleAllScenes(1.5, 1.5);

    expect(item1.setTransform).toHaveBeenCalledWith({
      position: { x: 150, y: 75 },
      scale: { x: 1.5, y: 1.5 },
    });
    expect(item2.setTransform).toHaveBeenCalledWith({
      position: { x: 0, y: 0 },
      scale: { x: 3, y: 0.75 },
    });
  });

  test('X/Y の倍率が異なる場合もそれぞれ独立して適用される', () => {
    setup();

    const { ScenesService } = require('./scenes');
    const instance = ScenesService.instance();

    const item = {
      transform: {
        position: { x: 128, y: 72 },
        scale: { x: 1, y: 1 },
        crop: { top: 0, right: 0, bottom: 0, left: 0 },
        rotation: 0,
      },
      setTransform: jest.fn(),
    };
    const scene = { getItems: jest.fn().mockReturnValue([item]) };

    Object.defineProperty(instance, 'scenes', {
      value: [scene],
      configurable: true,
    });

    // 720p(1280x720) -> 1080p(1920x1080)
    instance.rescaleAllScenes(1920 / 1280, 1080 / 720);

    expect(item.setTransform).toHaveBeenCalledWith({
      position: { x: 192, y: 108 },
      scale: { x: 1.5, y: 1.5 },
    });
  });

  test('アイテムが存在しないシーンでは何もしない', () => {
    setup();

    const { ScenesService } = require('./scenes');
    const instance = ScenesService.instance();

    const scene = { getItems: jest.fn().mockReturnValue([]) };
    Object.defineProperty(instance, 'scenes', {
      value: [scene],
      configurable: true,
    });

    expect(() => instance.rescaleAllScenes(1.5, 1.5)).not.toThrow();
  });
});
