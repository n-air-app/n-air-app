import path from 'path';

jest.mock('@electron/remote', () => ({
  app: { getAppPath: () => 'C:\\N Air\\resources\\app.asar' },
  require: jest.fn(() => ({ registerCallback: jest.fn(() => true) })),
}));

beforeEach(() => jest.resetModules());

test('loads libuiohook from the application directory instead of the Electron entry module', () => {
  const remote = require('@electron/remote');
  const { KeyListenerService } = require('./key-listener');
  const instance = KeyListenerService.instance();
  expect(remote.require).toHaveBeenCalledWith(path.join(
    'C:\\N Air\\resources\\app.asar', 'node_modules', 'node-libuiohook',
  ));
  expect(instance.register({ key: '65', eventType: 'registerKeydown', modifiers: {} })).toBe(true);
});
