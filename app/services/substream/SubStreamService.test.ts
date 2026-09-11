import { createSetupFunction } from 'util/test-setup';

const callEx = jest.fn();

jest.mock('./NamedPipeClient', () => ({
  NamedPipeClient: jest.fn().mockImplementation(() => ({
    call: jest.fn(),
    callEx,
    close: jest.fn(),
  })),
}));

const state = {
  use: true,
  url: 'rtmp://example.com/live',
  key: 'stream-key',
  selectedTab: 'other',
  tabs: {
    youtube: { url: '', key: '' },
    twitch: { url: '', key: '' },
    other: { url: 'rtmp://example.com/live', key: 'stream-key' },
  },
  videoBitrate: 2500,
  audioBitrate: 128,
  videoCodec: 'h264',
  keyintSec: 2,
  audioCodec: 'aac',
  sync: false,
};

const setup = createSetupFunction({
  state: { SubStreamService: state },
});

beforeEach(() => {
  jest.mock('services/core/stateful-service');
  jest.mock('services/core/injector');
  jest.resetModules();
  callEx.mockReset();
});

test('既にサブ配信中の開始操作は成功扱いにする', async () => {
  setup();
  callEx.mockResolvedValueOnce({ busy: false, streaming: true });

  const { SubStreamService } = require('./SubStreamService');
  const instance = SubStreamService.instance();

  await expect(instance.start()).resolves.toBeUndefined();
  expect(callEx).toHaveBeenCalledTimes(1);
  expect(callEx).toHaveBeenCalledWith('status');
});
