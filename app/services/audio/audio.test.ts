/**
 * AudioService: sourceUpdated 購読時の reroute_audio 判定のテスト
 *
 * 従来は getPropertiesFormData() の全プロパティ走査で reroute_audio を探していたが、
 * settings の直接読みに変更した(#1380)。挙動が変わりうる箇所（nvoice-character の
 * blacklist 差異、reroute_audio が undefined のケース）を中心に検証する。
 */
import { Subject } from 'rxjs';
import { createSetupFunction } from 'util/test-setup';

jest.mock('services/core/stateful-service');
jest.mock('services/core/injector');
jest.mock('services/core/service-initialization-observer', () => ({
  InitAfter: () => () => {},
}));
jest.mock('services/core/service-helper', () => ({
  ServiceHelper: () => () => {},
}));

jest.mock('services/i18n', () => ({ $t: (key: string) => key }));

jest.mock('services/sources', () => {
  const actual = jest.requireActual('services/sources/sources-api');
  return {
    isNoAudioPropertiesManagerType: actual.isNoAudioPropertiesManagerType,
  };
});

jest.mock('../../../obs-api', () => ({
  NodeObs: {
    RegisterVolmeterCallback: jest.fn(),
  },
  ESourceFlags: { ForceMono: 1 },
}));

function makeSourcesServiceMock() {
  return {
    sourceAdded: new Subject<any>(),
    sourceUpdated: new Subject<any>(),
    sourceRemoved: new Subject<any>(),
    getSource: jest.fn(),
  };
}

function makeObsInput(settings: Dictionary<any> = {}) {
  return { settings };
}

const setup = createSetupFunction({
  injectee: {
    ScenesService: { sceneSwitched: { subscribe: jest.fn() } },
    WindowsService: {},
  },
});

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
});

describe('AudioService: sourceUpdated での reroute_audio 判定', () => {
  function setupInstance() {
    const sourcesService = makeSourcesServiceMock();
    setup({ injectee: { SourcesService: sourcesService } });

    const { AudioService } = require('./audio');
    const instance = AudioService.instance();
    instance.state = { audioSources: { src1: { sourceId: 'src1' } } };
    // AudioSource の生成には AudioService/SourcesService への @Inject が必要で
    // このテストの主眼(reroute_audio 判定)には無関係なため、getSource をスタブして回避する
    instance.getSource = jest.fn().mockReturnValue(undefined);
    instance.init();

    const updateSpy = jest.spyOn(instance, 'UPDATE_AUDIO_SOURCE' as any);
    const changedSpy = jest.spyOn(instance.audioSourcesChanged, 'next');

    return { instance, sourcesService, updateSpy, changedSpy };
  }

  test('getPropertiesFormData を呼ばずに settings.reroute_audio から isControlledViaObs を設定する', () => {
    const { sourcesService, updateSpy, changedSpy } = setupInstance();

    const getPropertiesFormData = jest.fn();
    sourcesService.getSource.mockReturnValue({
      getObsInput: () => makeObsInput({ reroute_audio: true }),
      getPropertiesFormData,
    });

    sourcesService.sourceUpdated.next({
      sourceId: 'src1',
      audio: false,
      muted: false,
      propertiesManagerType: 'default',
    });

    expect(getPropertiesFormData).not.toHaveBeenCalled();
    expect(updateSpy).toHaveBeenCalledWith('src1', { isControlledViaObs: true });
    expect(changedSpy).toHaveBeenCalled();
  });

  test('reroute_audio が false でも isControlledViaObs が設定される', () => {
    const { sourcesService, updateSpy } = setupInstance();

    sourcesService.getSource.mockReturnValue({
      getObsInput: () => makeObsInput({ reroute_audio: false }),
    });

    sourcesService.sourceUpdated.next({
      sourceId: 'src1',
      audio: false,
      muted: false,
      propertiesManagerType: 'default',
    });

    expect(updateSpy).toHaveBeenCalledWith('src1', { isControlledViaObs: false });
  });

  test('reroute_audio が undefined（プロパティ自体を持たないソース）ならスキップする', () => {
    const { sourcesService, updateSpy, changedSpy } = setupInstance();

    sourcesService.getSource.mockReturnValue({
      getObsInput: () => makeObsInput({}),
    });

    sourcesService.sourceUpdated.next({
      sourceId: 'src1',
      audio: false,
      muted: false,
      propertiesManagerType: 'default',
    });

    expect(updateSpy).not.toHaveBeenCalled();
    expect(changedSpy).not.toHaveBeenCalled();
  });

  test('reroute_audio が null でもスキップする（generateAudioSourceData の == null 判定と揃える）', () => {
    const { sourcesService, updateSpy, changedSpy } = setupInstance();

    sourcesService.getSource.mockReturnValue({
      getObsInput: () => makeObsInput({ reroute_audio: null }),
    });

    sourcesService.sourceUpdated.next({
      sourceId: 'src1',
      audio: false,
      muted: false,
      propertiesManagerType: 'default',
    });

    expect(updateSpy).not.toHaveBeenCalled();
    expect(changedSpy).not.toHaveBeenCalled();
  });

  test('propertiesManagerType が nvoice-character の場合はスキップする（blacklist差異の維持）', () => {
    const { sourcesService, updateSpy } = setupInstance();

    sourcesService.getSource.mockReturnValue({
      getObsInput: () => makeObsInput({ reroute_audio: true }),
    });

    sourcesService.sourceUpdated.next({
      sourceId: 'src1',
      audio: false,
      muted: false,
      propertiesManagerType: 'nvoice-character',
    });

    expect(updateSpy).not.toHaveBeenCalled();
    expect(sourcesService.getSource).not.toHaveBeenCalled();
  });
});
