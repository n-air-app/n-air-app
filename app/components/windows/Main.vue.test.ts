import { webUtils } from 'electron';

jest.mock('electron', () => ({ webUtils: { getPathForFile: jest.fn() } }));
jest.mock('@electron/remote', () => ({
  getCurrentWindow: jest.fn(),
  dialog: { showMessageBox: jest.fn().mockResolvedValue({}) },
}));
jest.mock('components/nicolive-area/NicoliveArea.vue', () => ({}));
jest.mock('components/pages/Onboarding.vue', () => ({}));
jest.mock('components/pages/PatchNotes.vue', () => ({}));
jest.mock('components/pages/Studio.vue', () => ({}));
jest.mock('components/shared/CustomLoader.vue', () => ({}));
jest.mock('components/studio/SideNav.vue', () => ({}));
jest.mock('components/studio/StudioFooter.vue', () => ({}));
jest.mock('components/studio/TitleBar.vue', () => ({}));
jest.mock('services/app', () => ({}));
jest.mock('services/compact-mode', () => ({}));
jest.mock('services/i18n', () => ({ $t: (key: string) => key }));
jest.mock('services/navigation', () => ({}));
jest.mock('services/user', () => ({}));
jest.mock('services/window-size', () => ({}));
jest.mock('services/windows', () => ({}));
jest.mock('util/sentry-report', () => ({ SentryReport: { message: jest.fn() } }));

const addFile = jest.fn();
jest.mock('services/scenes', () => ({
  ScenesService: { instance: () => ({ activeScene: { addFile } }) },
}));

const Main = require('./Main.vue.ts').default;

beforeEach(() => jest.clearAllMocks());

test('uses webUtils to get the path of a dropped file', async () => {
  const file = { name: 'image.png' };
  (webUtils.getPathForFile as jest.Mock).mockReturnValue('C:\\image.png');
  await Main.methods.onDropHandler({ dataTransfer: { files: { length: 1, item: () => file } } });
  expect(webUtils.getPathForFile).toHaveBeenCalledWith(file);
  expect(addFile).toHaveBeenCalledWith('C:\\image.png');
});

test('warns when a dropped file has no filesystem path', async () => {
  (webUtils.getPathForFile as jest.Mock).mockReturnValue('');
  await Main.methods.onDropHandler({
    dataTransfer: { files: { length: 1, item: () => ({ name: 'image.png' }) } },
  });
  expect(addFile).not.toHaveBeenCalled();
  expect(require('@electron/remote').dialog.showMessageBox).toHaveBeenCalled();
});
