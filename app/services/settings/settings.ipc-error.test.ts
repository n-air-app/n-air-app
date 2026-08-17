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
jest.mock('services/obs-ipc-health', () => ({ ObsIpcHealthService: class {} }));
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
  let mockNotifyIpcLost: jest.Mock;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    jest.doMock('services/i18n', () => ({ $t: (key: string) => key }));

    mockNotifyIpcLost = jest.fn();

    ({ SettingsService } = require('./settings'));
    ({ IpcRequestError: IpcRequestErrorClass } = require('util/ipc-request-error'));

    instance = Object.create(SettingsService.prototype);
    instance.appService = { relaunch: jest.fn() };
    instance.windowsService = { getWindow: jest.fn().mockReturnValue(null) };
    instance.obsIpcHealthService = { notifyIpcLost: mockNotifyIpcLost };
    instance.obsIpcError = false;
    instance.settingsFormDataCache = new Map();
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
    test('obsIpcError フラグが true になりキャッシュを返す（キャッシュなしは空配列）', () => {
      jest.spyOn(instance, 'getSettingsFormDataImpl').mockImplementation(() => {
        throw new IpcRequestErrorClass('SettingsService', 'getSettingsFormData', { code: -32000 });
      });

      const result = instance.getSettingsFormData('General');

      expect(instance.obsIpcError).toBe(true);
      expect(result).toEqual([]); // キャッシュなしは空配列
    });

    test('IpcRequestError 発生前に成功していた場合はキャッシュを返す', () => {
      const cached = [{ nameSubCategory: 'cached', parameters: [] as any[] }];
      instance.settingsFormDataCache.set('General', cached);
      jest.spyOn(instance, 'getSettingsFormDataImpl').mockImplementation(() => {
        throw new IpcRequestErrorClass('SettingsService', 'getSettingsFormData', { code: -32000 });
      });

      const result = instance.getSettingsFormData('General');

      expect(result).toBe(cached);
    });

    test('notifyIpcLost が呼ばれる', () => {
      jest.spyOn(instance, 'getSettingsFormDataImpl').mockImplementation(() => {
        throw new IpcRequestErrorClass('SettingsService', 'getSettingsFormData', { code: -32000 });
      });

      instance.getSettingsFormData('General');

      expect(mockNotifyIpcLost).toHaveBeenCalledTimes(1);
      expect(mockNotifyIpcLost).toHaveBeenCalledWith('SettingsService.getSettingsFormData');
    });

    test('obsIpcError が true の場合は getSettingsFormDataImpl を呼ばずキャッシュを返す', () => {
      instance.obsIpcError = true;
      const cached = [{ nameSubCategory: 'cached', parameters: [] as any[] }];
      instance.settingsFormDataCache.set('General', cached);
      const implSpy = jest.spyOn(instance, 'getSettingsFormDataImpl');

      const result = instance.getSettingsFormData('General');

      expect(result).toBe(cached);
      expect(implSpy).not.toHaveBeenCalled();
    });

    test('2回目以降は getSettingsFormDataImpl を呼ばない', () => {
      jest.spyOn(instance, 'getSettingsFormDataImpl').mockImplementation(() => {
        throw new IpcRequestErrorClass('SettingsService', 'getSettingsFormData', { code: -32000 });
      });

      instance.getSettingsFormData('General');
      instance.getSettingsFormData('Output');
      instance.getSettingsFormData('Audio');

      expect(instance['getSettingsFormDataImpl']).toHaveBeenCalledTimes(1);
    });
  });

  describe('生のネイティブ IPC 切断エラー（IpcRequestError でない）', () => {
    test('Failed to make IPC call を含む生の Error でも notifyIpcLost が呼ばれキャッシュを返す', () => {
      jest.spyOn(instance, 'getSettingsFormDataImpl').mockImplementation(() => {
        throw new Error('INTERNAL_SERVER_ERROR Failed to make IPC call, verify IPC status.');
      });

      const result = instance.getSettingsFormData('General');

      expect(instance.obsIpcError).toBe(true);
      expect(mockNotifyIpcLost).toHaveBeenCalledWith('SettingsService.getSettingsFormData');
      expect(result).toEqual([]);
    });

    test('Lost IPC Connection を含む生の Error でも notifyIpcLost が呼ばれる', () => {
      jest.spyOn(instance, 'getSettingsFormDataImpl').mockImplementation(() => {
        throw new Error('Lost IPC Connection');
      });

      instance.getSettingsFormData('General');

      expect(mockNotifyIpcLost).toHaveBeenCalledWith('SettingsService.getSettingsFormData');
    });
  });

  describe('IpcRequestError 以外の例外', () => {
    test('obsIpcError を立てずに再 throw する', () => {
      const otherError = new Error('other error');
      jest.spyOn(instance, 'getSettingsFormDataImpl').mockImplementation(() => { throw otherError; });

      expect(() => instance.getSettingsFormData('General')).toThrow('other error');
      expect(instance.obsIpcError).toBe(false);
      expect(mockNotifyIpcLost).not.toHaveBeenCalled();
    });
  });
});
