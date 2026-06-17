import { jest_fn } from 'util/jest_fn';
import { createSetupFunction } from 'util/test-setup';

import type { TranscriptionSourceService as TranscriptionSourceServiceType } from './transcription-source';

const setup = createSetupFunction({
  state: {},
  injectee: {
    SourcesService: {
      createSource: jest_fn().mockName('createSource'),
      suggestName: jest_fn().mockName('suggestName').mockReturnValue('テキスト (文字起こし)'),
      getSource: jest_fn().mockName('getSource'),
    },
    VideoService: {
      baseWidth: 1920,
      baseHeight: 1080,
    },
    TranscriptionService: {
      state: { textFileMaxLine: 2 },
      getTextFilePath: jest_fn().mockName('getTextFilePath').mockReturnValue('/fake/transcription.txt'),
    },
    ScenesService: {
      activeScene: null as unknown,
    },
  },
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
  setup({
    injectee: {
      ScenesService: {
        activeScene,
      },
    },
  });

  const { TranscriptionSourceService } = require('./transcription-source') as {
    TranscriptionSourceService: typeof TranscriptionSourceServiceType;
  };
  return TranscriptionSourceService.instance();
}

describe('TranscriptionSourceService', () => {
  describe('getTranscriptionItemsInActiveScene', () => {
    it('activeScene が null のとき空配列を返す（クラッシュしない）', () => {
      const instance = prepare(null);
      expect(() => instance.getTranscriptionItemsInActiveScene()).not.toThrow();
      expect(instance.getTranscriptionItemsInActiveScene()).toEqual([]);
    });

    it('activeScene が存在するがアイテムがないとき空配列を返す', () => {
      const mockScene = {
        getItems: jest_fn().mockName('getItems').mockReturnValue([]),
      };
      const instance = prepare(mockScene);
      expect(instance.getTranscriptionItemsInActiveScene()).toEqual([]);
    });

    it('activeScene に text_transcription アイテムがあるときそれを返す', () => {
      const mockGetSource = jest_fn().mockName('getSource').mockReturnValue({
        getComparisonDetails: () => ({ propertiesManager: 'text_transcription' }),
      });
      setup({
        injectee: {
          SourcesService: {
            createSource: jest_fn().mockName('createSource'),
            suggestName: jest_fn().mockName('suggestName').mockReturnValue('テキスト (文字起こし)'),
            getSource: mockGetSource,
          },
          VideoService: { baseWidth: 1920, baseHeight: 1080 },
          TranscriptionService: {
            state: { textFileMaxLine: 2 },
            getTextFilePath: jest_fn().mockName('getTextFilePath').mockReturnValue('/fake/transcription.txt'),
          },
          ScenesService: {
            activeScene: {
              getItems: jest_fn().mockName('getItems').mockReturnValue([
                { sourceId: 'source-1' },
                { sourceId: 'source-2' },
              ]),
            },
          },
        },
      });
      const { TranscriptionSourceService } = require('./transcription-source') as {
        TranscriptionSourceService: typeof TranscriptionSourceServiceType;
      };
      const instance = TranscriptionSourceService.instance();
      const items = instance.getTranscriptionItemsInActiveScene();
      expect(items).toEqual([{ sourceId: 'source-1' }, { sourceId: 'source-2' }]);
    });

    it('activeScene に text_transcription 以外のアイテムのみのとき空配列を返す', () => {
      const mockGetSource = jest_fn().mockName('getSource').mockReturnValue({
        getComparisonDetails: () => ({ propertiesManager: 'default' }),
      });
      setup({
        injectee: {
          SourcesService: {
            createSource: jest_fn().mockName('createSource'),
            suggestName: jest_fn().mockName('suggestName').mockReturnValue('テキスト (文字起こし)'),
            getSource: mockGetSource,
          },
          VideoService: { baseWidth: 1920, baseHeight: 1080 },
          TranscriptionService: {
            state: { textFileMaxLine: 2 },
            getTextFilePath: jest_fn().mockName('getTextFilePath').mockReturnValue('/fake/transcription.txt'),
          },
          ScenesService: {
            activeScene: {
              getItems: jest_fn().mockName('getItems').mockReturnValue([
                { sourceId: 'source-other' },
              ]),
            },
          },
        },
      });
      const { TranscriptionSourceService } = require('./transcription-source') as {
        TranscriptionSourceService: typeof TranscriptionSourceServiceType;
      };
      const instance = TranscriptionSourceService.instance();
      expect(instance.getTranscriptionItemsInActiveScene()).toEqual([]);
    });
  });

  describe('containsTranscriptionInActiveScene', () => {
    it('activeScene が null のとき false を返す', () => {
      const instance = prepare(null);
      expect(instance.containsTranscriptionInActiveScene()).toBe(false);
    });

    it('activeScene に text_transcription があるとき true を返す', () => {
      const mockGetSource = jest_fn().mockName('getSource').mockReturnValue({
        getComparisonDetails: () => ({ propertiesManager: 'text_transcription' }),
      });
      setup({
        injectee: {
          SourcesService: {
            createSource: jest_fn().mockName('createSource'),
            suggestName: jest_fn().mockName('suggestName').mockReturnValue('テキスト (文字起こし)'),
            getSource: mockGetSource,
          },
          VideoService: { baseWidth: 1920, baseHeight: 1080 },
          TranscriptionService: {
            state: { textFileMaxLine: 2 },
            getTextFilePath: jest_fn().mockName('getTextFilePath').mockReturnValue('/fake/transcription.txt'),
          },
          ScenesService: {
            activeScene: {
              getItems: jest_fn().mockName('getItems').mockReturnValue([{ sourceId: 'source-1' }]),
            },
          },
        },
      });
      const { TranscriptionSourceService } = require('./transcription-source') as {
        TranscriptionSourceService: typeof TranscriptionSourceServiceType;
      };
      const instance = TranscriptionSourceService.instance();
      expect(instance.containsTranscriptionInActiveScene()).toBe(true);
    });
  });
});
