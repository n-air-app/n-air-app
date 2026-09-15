import fs from 'fs';

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

describe('SettingsService: isRecordingDiskSpaceLow', () => {
  let instance: any;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    jest.doMock('services/i18n', () => ({ $t: (key: string) => key }));

    const { SettingsService } = require('./settings');
    instance = Object.create(SettingsService.prototype);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function mockRecordingSettings(recType: string, path: string) {
    jest.spyOn(instance, 'getSettingsFormData').mockReturnValue([]);
    jest.spyOn(instance, 'getOutputMode').mockReturnValue(recType === 'Simple' ? 'Simple' : 'Advanced');
    jest.spyOn(instance, 'findSettingValue').mockImplementation((..._args: any[]) => {
      if (recType === 'Simple') return path;
      if (recType === 'Advanced/Standard') {
        const key = _args[2];
        if (key === 'RecType') return 'Standard';
        if (key === 'RecFilePath') return path;
      }
      if (recType === 'Advanced/Custom/URL') {
        const key = _args[2];
        if (key === 'RecType') return 'Custom Output (FFmpeg)';
        if (key === 'FFOutputToFile') return 0;
        if (key === 'FFURL') return path;
      }
      return undefined;
    });
  }

  test('空き容量が閾値未満ならtrueを返す', () => {
    mockRecordingSettings('Simple', '.');
    jest.spyOn(fs, 'statfsSync').mockReturnValue({ bavail: 100, bsize: 1 } as any);

    expect(instance.isRecordingDiskSpaceLow(1000)).toBe(true);
  });

  test('空き容量が閾値以上ならfalseを返す', () => {
    mockRecordingSettings('Simple', '.');
    jest.spyOn(fs, 'statfsSync').mockReturnValue({ bavail: 100000, bsize: 4096 } as any);

    expect(instance.isRecordingDiskSpaceLow(1000)).toBe(false);
  });

  test('URL出力の場合はチェック対象外でfalseを返す', () => {
    mockRecordingSettings('Advanced/Custom/URL', 'rtmp://example.com/live');
    const statfsSync = jest.spyOn(fs, 'statfsSync');

    expect(instance.isRecordingDiskSpaceLow()).toBe(false);
    expect(statfsSync).not.toHaveBeenCalled();
  });

  test('pathが取得できない場合はfalseを返す', () => {
    mockRecordingSettings('Simple', '');

    expect(instance.isRecordingDiskSpaceLow()).toBe(false);
  });

  test('statfsSyncが例外を投げた場合はfalseを返す', () => {
    mockRecordingSettings('Simple', '/nonexistent');
    jest.spyOn(fs, 'statfsSync').mockImplementation(() => {
      throw new Error('ENOENT');
    });

    expect(instance.isRecordingDiskSpaceLow()).toBe(false);
  });
});
