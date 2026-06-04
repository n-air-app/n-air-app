// Mock @electron/remote
const mockShowMessageBox = jest.fn();
const mockGetCurrentWindow = jest.fn().mockReturnValue({});
jest.mock('@electron/remote', () => ({
  dialog: { showMessageBox: mockShowMessageBox },
  getCurrentWindow: mockGetCurrentWindow,
}));

// Mock @sentry/vue
jest.mock('@sentry/vue', () => ({
  addBreadcrumb: jest.fn(),
}));

// Mock services/i18n
jest.mock('services/i18n', () => ({
  $t: (key: string) => key,
}));

// Mock Vue
jest.mock('vue', () => ({
  __esModule: true,
  default: class Vue {
    static use = jest.fn();
    $refs: any = {};
    $nextTick(fn: () => void) { Promise.resolve().then(fn); }
  },
}));

jest.mock('vue-property-decorator', () => ({
  Component: () => (target: any) => target,
  Watch: () => (_target: any, _key: string) => {},
  Inject: () => (_target: any, _key: string) => {},
}));

jest.mock('services/core/injector', () => ({
  Inject: () => (_target: any, _key: string) => {},
}));

jest.mock('components/obs/inputs/GenericFormGroups.vue', () => ({}));
jest.mock('components/settings/CategoryIcons', () => ({ CategoryIcons: {} }));
jest.mock('components/settings/CommentSettings.vue', () => ({}));
jest.mock('components/settings/CommentSpeechSettings.vue', () => ({}));
jest.mock('components/settings/ExtraSettings.vue', () => ({}));
jest.mock('components/settings/Hotkeys.vue', () => ({}));
jest.mock('components/settings/LanguageSettings.vue', () => ({}));
jest.mock('components/settings/SubStreamSettings.vue', () => ({}));
jest.mock('components/settings/TranscriptionSettings.vue', () => ({}));
jest.mock('components/shared/ModalLayout.vue', () => ({}));
jest.mock('components/shared/NavItem.vue', () => ({}));
jest.mock('components/shared/NavMenu.vue', () => ({}));
jest.mock('components/shared/TableOfContents.vue', () => ({}));
jest.mock('components/shared/TocManager', () => ({ TocManager: class { clearAll() {} clear() {} getSections(): any[] { return []; } generateId() { return ''; } register() {} unregister() {} } }));
jest.mock('components/shared/TocSection.vue', () => ({}));
jest.mock('services/app', () => ({ AppService: class {} }));
jest.mock('services/streaming', () => ({ StreamingService: class {} }));
jest.mock('services/user', () => ({ UserService: class {} }));
jest.mock('services/windows', () => ({ WindowsService: class {} }));
jest.mock('services/settings', () => ({}));

describe('Settings: loadSettingsFormData', () => {
  let Settings: any;
  let IpcRequestError: any;
  let instance: any;
  let mockGetSettingsFormData: jest.Mock;
  let mockRelaunch: jest.Mock;
  let mockOfferRestart: jest.SpyInstance;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    // Re-apply mocks after resetModules
    jest.doMock('@electron/remote', () => ({
      dialog: { showMessageBox: mockShowMessageBox },
      getCurrentWindow: mockGetCurrentWindow,
    }));
    jest.doMock('@sentry/vue', () => ({ addBreadcrumb: jest.fn() }));
    jest.doMock('services/i18n', () => ({ $t: (key: string) => key }));

    mockGetSettingsFormData = jest.fn().mockReturnValue([]);
    mockRelaunch = jest.fn();

    ({ default: Settings } = require('./Settings.vue.ts'));
    ({ IpcRequestError } = require('util/ipc-request-error'));

    // コンストラクタで settingsService.getCategories() が呼ばれるため
    // Object.create でインスタンスを作り、プロパティを先に設定してから初期化する
    instance = Object.create(Settings.prototype);
    instance.settingsService = { getSettingsFormData: mockGetSettingsFormData, getCategories: jest.fn().mockReturnValue([]) };
    instance.appService = { relaunch: mockRelaunch };
    instance.settingsData = [];
    instance.ipcError = false;
  });

  describe('正常系', () => {
    test('getSettingsFormData が成功した場合はその戻り値を返す', () => {
      const expected = [{ cname: 'test', parameters: [] as any[] }];
      mockGetSettingsFormData.mockReturnValue(expected);

      const result = instance['loadSettingsFormData']('General');

      expect(result).toBe(expected);
      expect(instance.ipcError).toBe(false);
    });
  });

  describe('IpcRequestError 発生時', () => {
    test('ipcError フラグが true になる', () => {
      const rpcError = { code: -32000 };
      mockGetSettingsFormData.mockImplementation(() => {
        throw new IpcRequestError('SettingsService', 'getSettingsFormData', rpcError);
      });
      mockShowMessageBox.mockResolvedValue({ response: 1 });

      expect(() => instance['loadSettingsFormData']('General')).toThrow(IpcRequestError);
      expect(instance.ipcError).toBe(true);
    });

    test('ipcError が true の状態では settingsData をそのまま返し getSettingsFormData を呼ばない', () => {
      instance.ipcError = true;
      instance.settingsData = [{ cname: 'cached', parameters: [] }];

      const result = instance['loadSettingsFormData']('General');

      expect(result).toBe(instance.settingsData);
      expect(mockGetSettingsFormData).not.toHaveBeenCalled();
    });

    test('offerRestart が呼ばれる', () => {
      const rpcError = { code: -32000 };
      mockGetSettingsFormData.mockImplementation(() => {
        throw new IpcRequestError('SettingsService', 'getSettingsFormData', rpcError);
      });
      mockShowMessageBox.mockResolvedValue({ response: 1 });
      const offerRestartSpy = jest.spyOn(instance, 'offerRestart').mockResolvedValue(undefined);

      expect(() => instance['loadSettingsFormData']('General')).toThrow();
      expect(offerRestartSpy).toHaveBeenCalledTimes(1);
    });

    test('2回目以降の呼び出しはスキップされ getSettingsFormData は追加で呼ばれない', () => {
      const rpcError = { code: -32000 };
      mockGetSettingsFormData.mockImplementation(() => {
        throw new IpcRequestError('SettingsService', 'getSettingsFormData', rpcError);
      });
      mockShowMessageBox.mockResolvedValue({ response: 1 });
      jest.spyOn(instance, 'offerRestart').mockResolvedValue(undefined);

      // 1回目: エラー
      expect(() => instance['loadSettingsFormData']('General')).toThrow();
      expect(mockGetSettingsFormData).toHaveBeenCalledTimes(1);

      // 2回目以降: スキップ
      instance['loadSettingsFormData']('Output');
      instance['loadSettingsFormData']('Audio');
      expect(mockGetSettingsFormData).toHaveBeenCalledTimes(1); // 増えない
    });
  });

  describe('IpcRequestError 以外の例外', () => {
    test('ipcError フラグは立てず例外をそのまま再 throw する', () => {
      const otherError = new Error('other error');
      mockGetSettingsFormData.mockImplementation(() => { throw otherError; });

      expect(() => instance['loadSettingsFormData']('General')).toThrow('other error');
      expect(instance.ipcError).toBe(false);
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
