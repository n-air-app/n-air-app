// Mock @electron/remote
const mockShowMessageBox = jest.fn();
const mockGetCurrentWindow = jest.fn().mockReturnValue({});
jest.mock('@electron/remote', () => ({
  dialog: { showMessageBox: mockShowMessageBox },
  getCurrentWindow: mockGetCurrentWindow,
}));

jest.mock('@sentry/vue', () => ({ addBreadcrumb: jest.fn() }));
jest.mock('services/i18n', () => ({ $t: (key: string) => key }));

jest.mock('services/core/stateful-service', () => ({
  StatefulService: class {
    static initialState: any = {};
    static store: any = { watch: jest.fn() };
    static getState() { return {}; }
  },
  mutation: () => (_target: any, _key: string, descriptor: any) => descriptor,
}));
jest.mock('services/core/injector', () => ({
  Inject: () => (_target: any, _key: string) => {},
}));

jest.mock('services/app', () => ({ AppService: class {} }));
jest.mock('services/audio', () => ({ AudioService: class {}, E_AUDIO_CHANNELS: {} }));
jest.mock('services/dismissables', () => ({ DismissablesService: class {}, EDismissable: {} }));
jest.mock('services/nicolive-program/nicolive-comment-synthesizer', () => ({ NicoliveCommentSynthesizerService: class {} }));
jest.mock('services/nicolive-program/state', () => ({ NicoliveProgramStateService: class {} }));
jest.mock('services/sound-detector', () => ({ SoundDetectorService: class {} }));
jest.mock('services/sources', () => ({ SourcesService: class {} }));
jest.mock('services/user', () => ({ UserService: class {} }));
jest.mock('services/windows', () => ({ WindowsService: class {} }));
jest.mock('services/settings-v2', () => ({ VideoSettingsService: class {} }));
jest.mock('services/utils', () => ({ default: { isDevMode: () => false } }));
jest.mock('../../../obs-api', () => ({ NodeObs: {} }));
jest.mock('components/obs/inputs/ObsInput', () => ({
  obsValuesToInputValues: jest.fn().mockReturnValue([]),
  inputValuesToObsValues: jest.fn().mockReturnValue([]),
}));
jest.mock('lodash/cloneDeep', () => (x: any) => x);
jest.mock('util/sentry-obs-breadcrumb', () => ({ markObsOp: jest.fn() }));
jest.mock('util/sentry-report', () => ({ SentryReport: { error: jest.fn() } }));
jest.mock('./niconico-optimization', () => ({ getBestSettingsForNiconico: jest.fn() }));
jest.mock('./optimizer', () => ({}));
jest.mock('./settings-api', () => ({}));

describe('SettingsService: getSettingsFormData IPC エラーハンドリング', () => {
  let SettingsService: any;
  let IpcRequestErrorClass: any;
  let instance: any;
  let mockRelaunch: jest.Mock;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    jest.doMock('@electron/remote', () => ({
      dialog: { showMessageBox: mockShowMessageBox },
      getCurrentWindow: mockGetCurrentWindow,
    }));
    jest.doMock('services/i18n', () => ({ $t: (key: string) => key }));

    mockRelaunch = jest.fn();

    ({ SettingsService } = require('./settings'));
    ({ IpcRequestError: IpcRequestErrorClass } = require('util/ipc-request-error'));

    instance = Object.create(SettingsService.prototype);
    instance.appService = { relaunch: mockRelaunch };
    instance.obsIpcError = false;
  });

  describe('正常系', () => {
    test('getSettingsFormDataImpl の戻り値をそのまま返す', () => {
      const expected = [{ cname: 'test', nameSubCategory: 'test', parameters: [] as any[] }];
      jest.spyOn(instance, 'getSettingsFormDataImpl').mockReturnValue(expected);

      const result = instance.getSettingsFormData('General');

      expect(result).toBe(expected);
      expect(instance.obsIpcError).toBe(false);
    });
  });

  describe('IpcRequestError 発生時', () => {
    test('obsIpcError フラグが true になり空配列を返す', () => {
      jest.spyOn(instance, 'getSettingsFormDataImpl').mockImplementation(() => {
        throw new IpcRequestErrorClass('SettingsService', 'getSettingsFormData', { code: -32000 });
      });
      jest.spyOn(instance, 'offerRestart').mockResolvedValue(undefined);

      const result = instance.getSettingsFormData('General');

      expect(instance.obsIpcError).toBe(true);
      expect(result).toEqual([]);
    });

    test('offerRestart が呼ばれる', () => {
      jest.spyOn(instance, 'getSettingsFormDataImpl').mockImplementation(() => {
        throw new IpcRequestErrorClass('SettingsService', 'getSettingsFormData', { code: -32000 });
      });
      const offerRestartSpy = jest.spyOn(instance, 'offerRestart').mockResolvedValue(undefined);

      instance.getSettingsFormData('General');

      expect(offerRestartSpy).toHaveBeenCalledTimes(1);
    });

    test('obsIpcError が true の場合は getSettingsFormDataImpl を呼ばずに空配列を返す', () => {
      instance.obsIpcError = true;
      const implSpy = jest.spyOn(instance, 'getSettingsFormDataImpl');

      const result = instance.getSettingsFormData('General');

      expect(result).toEqual([]);
      expect(implSpy).not.toHaveBeenCalled();
    });

    test('2回目以降は getSettingsFormDataImpl を呼ばない', () => {
      jest.spyOn(instance, 'getSettingsFormDataImpl').mockImplementation(() => {
        throw new IpcRequestErrorClass('SettingsService', 'getSettingsFormData', { code: -32000 });
      });
      jest.spyOn(instance, 'offerRestart').mockResolvedValue(undefined);

      instance.getSettingsFormData('General');
      instance.getSettingsFormData('Output');
      instance.getSettingsFormData('Audio');

      expect(instance['getSettingsFormDataImpl']).toHaveBeenCalledTimes(1);
    });
  });

  describe('IpcRequestError 以外の例外', () => {
    test('obsIpcError を立てずに再 throw する', () => {
      const otherError = new Error('other error');
      jest.spyOn(instance, 'getSettingsFormDataImpl').mockImplementation(() => { throw otherError; });

      expect(() => instance.getSettingsFormData('General')).toThrow('other error');
      expect(instance.obsIpcError).toBe(false);
    });
  });

  describe('offerRestart', () => {
    test('ダイアログで「はい」を選ぶと relaunch が呼ばれる', async () => {
      mockShowMessageBox.mockResolvedValue({ response: 0 });

      await instance['offerRestart']();

      expect(mockRelaunch).toHaveBeenCalledTimes(1);
    });

    test('ダイアログで「いいえ」を選ぶと relaunch は呼ばれない', async () => {
      mockShowMessageBox.mockResolvedValue({ response: 1 });

      await instance['offerRestart']();

      expect(mockRelaunch).not.toHaveBeenCalled();
    });
  });
});
