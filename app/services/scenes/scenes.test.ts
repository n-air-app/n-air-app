/**
 * ScenesService.rescaleAllScenes のテスト
 *
 * キャンバス解像度(Base)変更時に既存シーンのレイアウトを保つため、
 * 全シーンの全アイテムの position/scale を倍率でスケールする処理を検証する。
 * 90/270度回転アイテムでは scale のX/Y倍率を入れ替える必要があるため、そのケースも検証する。
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

    // X/Y で異なる倍率(浮動小数点誤差を避けるため両方とも正確に表現できる値を使う)
    instance.rescaleAllScenes(1.5, 1.25);

    expect(item.setTransform).toHaveBeenCalledWith({
      position: { x: 192, y: 90 },
      scale: { x: 1.5, y: 1.25 },
    });
  });

  test('90度/270度回転しているアイテムは scale のX/Y倍率が入れ替わって適用される', () => {
    setup();

    const { ScenesService } = require('./scenes');
    const instance = ScenesService.instance();

    const item90 = {
      transform: {
        position: { x: 100, y: 50 },
        scale: { x: 1, y: 2 },
        crop: { top: 0, right: 0, bottom: 0, left: 0 },
        rotation: 90,
      },
      setTransform: jest.fn(),
    };
    const item270 = {
      transform: {
        position: { x: 10, y: 20 },
        scale: { x: 3, y: 4 },
        crop: { top: 0, right: 0, bottom: 0, left: 0 },
        rotation: 270,
      },
      setTransform: jest.fn(),
    };
    const scene = { getItems: jest.fn().mockReturnValue([item90, item270]) };

    Object.defineProperty(instance, 'scenes', {
      value: [scene],
      configurable: true,
    });

    instance.rescaleAllScenes(2, 3);

    // position はキャンバス座標系そのままなので factorX/factorY をそのまま適用
    // scale はアイテムのローカル座標系基準なので、90/270度回転時はX/Y倍率を入れ替えて適用
    expect(item90.setTransform).toHaveBeenCalledWith({
      position: { x: 200, y: 150 },
      scale: { x: 3, y: 4 },
    });
    expect(item270.setTransform).toHaveBeenCalledWith({
      position: { x: 20, y: 60 },
      scale: { x: 9, y: 8 },
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
