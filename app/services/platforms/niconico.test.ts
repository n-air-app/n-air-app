import { jest_fn } from 'util/jest_fn';
import { createSetupFunction } from 'util/test-setup';
import { NiconicoService as NiconicoServiceType } from './niconico';

const setup = createSetupFunction({
  injectee: {
    HostsService: {},
    SettingsService: {},
    UserService: {},
    StreamingService: {
      streamingStatusChange: {
        subscribe() {},
      },
    },
    WindowsService: {},
    CustomizationService: {
      state: {
        enableRtmps: false,
      },
    },
  },
});

jest.mock('services/core/stateful-service');
jest.mock('services/core/injector');
jest.mock('services/streaming', () => ({}));
jest.mock('services/user', () => ({}));
jest.mock('services/settings', () => ({}));
jest.mock('services/customization', () => ({}));
jest.mock('services/windows', () => ({}));
jest.mock('services/i18n', () => ({
  $t: (x: any) => x,
}));
jest.mock('util/sleep', () => ({
  sleep: () => jest.requireActual('util/sleep').sleep(0),
}));
jest.mock('util/menus/Menu', () => ({}));
jest.mock('services/sources');
jest.mock('services/i18n', () => ({
  $t: (x: any) => x,
}));
jest.mock('@electron/remote', () => ({
  BrowserWindow: jest.fn(),
}));

beforeEach(() => {
  jest.resetModules();
});

function setupInstance() {
  const { NiconicoService } = require('./niconico');
  const { instance } = NiconicoService as { instance: NiconicoServiceType };

  instance.client.fetchIngestInfo = jest_fn<
    typeof instance.client.fetchIngestInfo
  >().mockImplementation((_programId: string) =>
    Promise.resolve({
      ok: true,
      value: {
        rtmp: {
          tcUrl: 'rtmp url',
          streamName: 'rtmp key',
          appName: 'app name',
        },
        rtmps: {
          tcUrl: 'rtmps url',
          streamName: 'rtmps key',
          appName: 'app name',
        },
      },
    }),
  );
  instance.client.fetchMaxQuality = jest_fn<
    typeof instance.client.fetchMaxQuality
  >().mockImplementation((programId: string) =>
    Promise.resolve({
      bitrate: 6000,
      height: 720,
      fps: 30,
    }),
  );
  return instance;
}

test('get instance', () => {
  setup();
  const { NiconicoService } = require('./niconico');
  expect(NiconicoService.instance).toBeInstanceOf(NiconicoService);
});

describe('setupStreamSettingsでストリーム情報がとれた場合', () => {
  for (const enableRtmps of [false, true]) {
    test(`enableRtmps: ${enableRtmps}`, async () => {
      const updatePlatformChannelId = jest.fn().mockName('updatePlatformChannelId');
      const getSettingsFormData = jest.fn().mockName('getSettingsFormData');
      const setSettings = jest.fn().mockName('setSettings');
      const showWindow = jest.fn().mockName('showWindow');

      getSettingsFormData.mockReturnValue([
        {
          nameSubCategory: 'Untitled',
          parameters: [
            { name: 'service', value: '' },
            { name: 'server', value: '' },
            { name: 'key', value: '' },
          ],
        },
      ]);

      const injectee = {
        UserService: {
          updatePlatformChannelId,
        },
        SettingsService: {
          getSettingsFormData,
          setSettings,
        },
        WindowsService: {
          showWindow,
        },
        CustomizationService: {
          state: {
            enableRtmps,
          },
        },
      };

      setup({ injectee });
      const instance = setupInstance();

      const result = await instance.setupStreamSettings('lv12345');
      expect(result).toEqual({
        url: enableRtmps ? 'rtmps url' : 'rtmp url',
        key: enableRtmps ? 'rtmps key' : 'rtmp key',
        quality: {
          bitrate: 6000,
          height: 720,
          fps: 30,
        },
      });

      expect(setSettings).toHaveBeenCalledTimes(1);
      expect(setSettings.mock.calls[0]).toMatchSnapshot();
    });
  }
});

test('setupStreamSettingsで番組取得にリトライで成功する場合', async () => {
  const updatePlatformChannelId = jest.fn();
  const getSettingsFormData = jest.fn();
  const setSettings = jest.fn();

  getSettingsFormData.mockReturnValue([
    {
      nameSubCategory: 'Untitled',
      parameters: [
        { name: 'service', value: '' },
        { name: 'server', value: '' },
        { name: 'key', value: '' },
      ],
    },
  ]);

  const injectee = {
    UserService: { updatePlatformChannelId },
    SettingsService: { getSettingsFormData, setSettings },
  };

  setup({ injectee });
  const instance = setupInstance();

  const result = await instance.setupStreamSettings('');
  expect(result).toEqual({
    url: 'rtmp url',
    key: 'rtmp key',
    quality: {
      bitrate: 6000,
      height: 720,
      fps: 30,
    },
  });
  expect(setSettings).toHaveBeenCalledTimes(1);
  expect(setSettings.mock.calls[0]).toMatchSnapshot();
});
