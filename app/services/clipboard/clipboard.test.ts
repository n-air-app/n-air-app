import { createSetupFunction } from 'util/test-setup';

jest.mock('services/core/stateful-service');
jest.mock('services/core/injector');
jest.mock('services/scene-collections', () => ({}));
jest.mock('services/scenes', () => ({}));
jest.mock('services/selection', () => ({}));
jest.mock('services/source-filters', () => ({}));
jest.mock('services/sources', () => ({}));
jest.mock('services/shortcuts', () => ({ shortcut: () => () => {} }));
jest.mock('@electron/remote', () => ({ clipboard: { readText: jest.fn() } }));

const setup = createSetupFunction();

function target() {
  const copyTo = jest.fn(() => []);
  const scenesService = {
    activeScene: { id: 'scene' },
    activeSceneId: 'scene',
    getScene: () => ({ getSelection: () => ({ copyTo }) }),
  };
  setup({
    injectee: {
      ScenesService: scenesService,
      SceneCollectionsService: { collectionWillSwitch: { subscribe: jest.fn() } },
      SelectionService: { getIds: () => ['item'], select: jest.fn() },
    },
  });
  const { ClipboardService } = require('./clipboard');
  const instance = ClipboardService.instance();
  instance.state = structuredClone(ClipboardService.initialState);
  const { clipboard } = require('@electron/remote');
  return { instance, clipboard, copyTo, scenesService };
}

beforeEach(() => {
  jest.resetModules();
});

test('waits for asynchronous clipboard initialization before pasting copied items', async () => {
  const { instance, clipboard, copyTo } = target();
  let resolve!: (value: string) => void;
  clipboard.readText.mockReturnValueOnce(new Promise<string>((r) => { resolve = r; }));
  clipboard.readText.mockResolvedValue('unchanged');
  instance.init();
  instance.copy();
  const pending = instance.paste(true);
  expect(copyTo).not.toHaveBeenCalled();
  resolve('unchanged');
  await pending;
  expect(copyTo).toHaveBeenCalledWith('scene', undefined, true);
  expect(instance.state.systemClipboard.text).toBe('unchanged');
});

test('pastes when the active scene wrapper is recreated with the same ID', async () => {
  const { instance, clipboard, copyTo, scenesService } = target();
  clipboard.readText.mockImplementation(async () => {
    scenesService.activeScene = { id: 'scene' };
    return '';
  });
  instance.getFiles = jest.fn(() => []);
  instance.copy();
  await instance.paste();
  expect(copyTo).toHaveBeenCalledWith('scene', undefined, false);
});

test('does not paste if the active scene disappears during the clipboard read', async () => {
  const { instance, clipboard, copyTo } = target();
  clipboard.readText.mockImplementation(async () => {
    instance.scenesService.activeScene = undefined;
    return 'text';
  });
  await instance.paste();
  expect(copyTo).not.toHaveBeenCalled();
});

test('does not paste into a scene selected while waiting for the clipboard', async () => {
  const { instance, clipboard, copyTo } = target();
  clipboard.readText.mockImplementation(async () => {
    instance.scenesService.activeScene = { id: 'other' };
    return 'text';
  });
  await instance.paste();
  expect(copyTo).not.toHaveBeenCalled();
});
