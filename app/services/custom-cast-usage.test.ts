import { Subject } from 'rxjs';
import { jest_fn } from 'util/jest_fn';
import { createSetupFunction } from 'util/test-setup';

import type { CustomcastUsageService as CustomcastUsageServiceType } from './custom-cast-usage';

const setup = createSetupFunction({
  state: {},
});

beforeEach(() => {
  jest.doMock('services/core/stateful-service');
  jest.doMock('services/core/injector');
  jest.resetModules();
});

afterEach(() => {
  jest.clearAllMocks();
  jest.resetModules();
});

function prepare(activeScene: unknown = null) {
  const sceneSwitched = new Subject<void>();
  const itemAdded = new Subject<{ sourceId: string }>();

  setup({
    injectee: {
      ScenesService: {
        activeScene,
        sceneSwitched,
        itemAdded,
      },
      SourcesService: {
        getSource: jest_fn().mockName('getSource'),
      },
      NicoliveProgramService: {
        state: { programID: '' },
      },
    },
  });

  const { CustomcastUsageService } = require('./custom-cast-usage') as {
    CustomcastUsageService: typeof CustomcastUsageServiceType;
  };
  const instance = CustomcastUsageService.instance();

  return { instance, sceneSwitched, itemAdded };
}

describe('CustomcastUsageService', () => {
  describe('containsCustomcastInActiveScene', () => {
    it('activeScene が null のとき false を返す（クラッシュしない）', () => {
      const { instance } = prepare(null);
      expect(() => instance.containsCustomcastInActiveScene()).not.toThrow();
      expect(instance.containsCustomcastInActiveScene()).toBe(false);
    });

    it('activeScene が存在するがカスタムキャストがないとき false を返す', () => {
      const mockScene = {
        getItems: jest_fn().mockName('getItems').mockReturnValue([]),
      };
      const { instance } = prepare(mockScene);
      expect(instance.containsCustomcastInActiveScene()).toBe(false);
    });

    it('activeScene にカスタムキャストのアイテムがあるとき true を返す', () => {
      const mockScene = {
        getItems: jest_fn().mockName('getItems').mockReturnValue([{ sourceId: 'source-1' }]),
      };
      const sceneSwitched = new Subject<void>();
      const itemAdded = new Subject<{ sourceId: string }>();

      setup({
        injectee: {
          ScenesService: {
            activeScene: mockScene,
            sceneSwitched,
            itemAdded,
          },
          SourcesService: {
            getSource: jest_fn().mockName('getSource').mockReturnValue({
              getComparisonDetails: () => ({ propertiesManager: 'custom-cast-ndi' }),
            }),
          },
          NicoliveProgramService: {
            state: { programID: '' },
          },
        },
      });

      const { CustomcastUsageService } = require('./custom-cast-usage') as {
        CustomcastUsageService: typeof CustomcastUsageServiceType;
      };
      const instance = CustomcastUsageService.instance();

      expect(instance.containsCustomcastInActiveScene()).toBe(true);
    });
  });

  describe('startStreaming', () => {
    it('activeScene が null でもクラッシュせず isCustomcastUsed は false のままになる', () => {
      const { instance } = prepare(null);
      expect(() => instance.startStreaming()).not.toThrow();
      expect(instance.state.isCustomcastUsed).toBe(false);
    });
  });
});
