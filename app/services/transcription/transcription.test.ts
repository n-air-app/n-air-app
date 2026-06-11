import * as FakeTimers from '@sinonjs/fake-timers';
import { Subject } from 'rxjs';
import { jest_fn } from 'util/jest_fn';
import { createSetupFunction } from 'util/test-setup';

import type { downloadAndUnzip as downloadAndUnzipType } from './downloadAndUnzip';
import type { filterNoiseText as filterNoiseTextType } from './filterNoiseText';
import type { TranscriptionService as TranscriptionServiceType } from './transcription';
import type {
  CreateVoskCliClient as CreateVoskCliClientType,
  TranscriptionMessage,
  VoskClient as VoskClientType,
} from './VoskClient';

const VOSK_MODEL_NAME = 'vosk-model-small-ja-0.22';
const VOSK_MODEL_NAME_2 = 'vosk-model-ja-0.22';

// Mock dependencies
jest.mock('@electron/remote', () => ({
  app: {
    getPath: jest_fn<() => string>().mockName('getPath').mockReturnValue('/fake/path'),
  },
}));
jest.mock('node:fs', () => ({
  promises: {
    writeFile: jest_fn<() => Promise<void>>().mockName('writeFile').mockResolvedValue(undefined),
    unlink: jest_fn<() => Promise<void>>().mockName('unlink').mockResolvedValue(undefined),
    rmdir: jest_fn<() => Promise<void>>().mockName('rmdir').mockResolvedValue(undefined),
  },
  existsSync: jest_fn<() => boolean>().mockName('existsSync'),
}));
jest.mock('node:os', () => ({
  tmpdir: jest_fn<() => string>().mockName('tmpdir').mockReturnValue('/fake/tmp'),
}));
jest.mock('node:path', () => ({
  join: (...args: string[]) => args.join('/'),
}));
jest.mock('services/i18n', () => ({
  $t: jest_fn<(key: string) => string>()
    .mockName('$t')
    .mockImplementation((key) => key),
}));
jest.mock('./downloadAndUnzip', () => {
  const actual = jest.requireActual('./downloadAndUnzip');
  return {
    ...actual,
    downloadAndUnzip: jest_fn<typeof downloadAndUnzipType>().mockName('downloadAndUnzip'),
  };
});
jest.mock('./filterNoiseText', () => ({
  filterNoiseText: jest_fn<typeof filterNoiseTextType>()
    .mockName('filterNoiseText')
    .mockImplementation((text) => text),
}));
jest.mock('./VoskClient', () => {
  const actual = jest.requireActual('./VoskClient');
  return {
    ...actual,
    CreateVoskCliClient: jest_fn<typeof CreateVoskCliClientType>().mockName('CreateVoskCliClient'),
    getVoskCliPath: jest_fn<() => string>()
      .mockName('getVoskCliPath')
      .mockReturnValue('/fake/vosk-cli'),
    VoskClient: {
      ...actual.VoskClient,
      listAudioDevices: jest_fn<typeof VoskClientType.listAudioDevices>()
        .mockName('listAudioDevices')
        .mockReturnValue({
          version: '1',
          devices: [{ id: 'test-device', name: 'Test Device', index: 0 }],
        }),
    },
  };
});

const setup = createSetupFunction({
  state: {},
  injectee: {
    AudioService: {
      getSourceByDeviceId: jest_fn().mockName('getSourceByDeviceId').mockReturnValue(undefined),
      getDevices: jest_fn()
        .mockName('getDevices')
        .mockReturnValue([{ id: 'test-device', description: 'Test Device', type: 'input' }]),
      audioSourceUpdated: new Subject(),
    },
    TranscriptionSourceService: {
      updateTranscriptionLines: jest_fn().mockName('updateTranscriptionLines'),
    },
  },
});

beforeEach(() => {
  jest.doMock('services/core/stateful-service');
  jest.doMock('services/core/injector');
  jest.doMock('services/core/persistent-stateful-service', () => ({
    // PersistentStatefulService を StatefulService でモックする
    // 注意: 初期ステートは defaultState に書かれているが、initialState が読まれるので調整が必要
    PersistentStatefulService: require('services/core/stateful-service').StatefulService,
  }));
});

afterEach(() => {
  jest.clearAllMocks();
  jest.resetModules();
});

interface PrepareOptions {
  mockOverrides?: {
    listAudioDevices?: {
      version: string;
      devices: Array<{ id: string; name: string; index: number }>;
    };
    voskModelStatus?: { state: string };
    audioDevices?: Array<{ id: string; name: string }>;
    // AudioService.getDevices() が返すデバイスリスト (type='input'|'output' を含む)
    obsAudioDevices?: Array<{ id: string; description: string; type: 'input' | 'output' }>;
    // AudioService の任意メソッドを上書き
    audioServiceOverride?: Partial<{
      getDevices: jest.Mock;
      getSourceByDeviceId: jest.Mock;
    }>;
  };
}

interface TestScenario {
  name: string;
  setup: (instance: TranscriptionServiceType) => void;
  modelDownloaded?: boolean;
  expectStartTranscription: boolean;
}

// Test utilities
const emptyDeviceList = {
  version: '1' as const,
  devices: [] as Array<{ id: string; name: string; index: number }>,
};
const testDeviceList = {
  version: '1',
  devices: [{ id: 'test-device', name: 'Test Device', index: 0 }],
};

function withClock(testFn: (clock: FakeTimers.InstalledClock) => Promise<void>) {
  return async () => {
    const clock = FakeTimers.install();
    try {
      await testFn(clock);
    } finally {
      clock.uninstall();
    }
  };
}

function setupTranscription(
  options: {
    modelDownloaded?: boolean;
    audioDeviceId?: string;
    emptyDevices?: boolean;
  } = {},
) {
  const downloadedStatus = { state: 'downloaded' as const };
  const notDownloadedStatus = { state: 'not_downloaded' as const };

  const prepareOptions = options.emptyDevices
    ? {
      mockOverrides: {
        listAudioDevices: emptyDeviceList,
        voskModelStatus: options.modelDownloaded ? downloadedStatus : notDownloadedStatus,
      },
    }
    : {
      mockOverrides: {
        voskModelStatus: options.modelDownloaded ? downloadedStatus : notDownloadedStatus,
      },
    };

  const { instance, ...rest } = prepare(prepareOptions);

  if (options.modelDownloaded) {
    rest.getVoskModelStatus.mockReturnValue(downloadedStatus);
    // Also update the modelsStatusSubject$ to reflect the downloaded state
    instance['setModelStatus'](VOSK_MODEL_NAME, downloadedStatus);
  }
  if (options.audioDeviceId) {
    instance.setAudioDeviceId(options.audioDeviceId);
  }

  return { instance, ...rest };
}

function prepare(options: PrepareOptions = {}): {
  TranscriptionService: typeof TranscriptionServiceType;
  instance: TranscriptionServiceType;
  getVoskModelStatus: jest.Mock;
  setVoskModelStatus: jest.Mock;
  client: VoskClientType;
  transcriptionMessages$: Subject<TranscriptionMessage>;
  stopTranscription: jest.Mock;
  audioSourceUpdated: Subject<unknown>;
} {
  const obsAudioDevicesOverride = options.mockOverrides?.obsAudioDevices;
  const audioServiceOverride = options.mockOverrides?.audioServiceOverride;
  const audioSourceUpdated = new Subject<unknown>();
  const audioServiceInjectee: Record<string, unknown> = { audioSourceUpdated };
  if (obsAudioDevicesOverride) {
    audioServiceInjectee.getDevices = jest_fn().mockReturnValue(obsAudioDevicesOverride);
  }
  if (audioServiceOverride) {
    Object.assign(audioServiceInjectee, audioServiceOverride);
  }
  setup({ injectee: { AudioService: audioServiceInjectee } });

  const getVoskModelStatus = jest_fn()
    .mockName('getVoskModelStatus')
    .mockReturnValue(options.mockOverrides?.voskModelStatus ?? { state: 'not_downloaded' });
  const getVoskModels = jest_fn()
    .mockName('getVoskModels')
    .mockReturnValue([
      {
        name: VOSK_MODEL_NAME,
        description: 'small',
        status: options.mockOverrides?.voskModelStatus ?? { state: 'not_downloaded' },
      },
    ]);
  const setVoskModelStatus = jest_fn().mockName('setVoskModelStatus');
  jest.doMock('./VoskModelsManager', () => ({
    ...(jest.requireActual('./VoskModelsManager') as {}),
    VoskModelsManager: class {
      getVoskModelStatus = getVoskModelStatus;
      getVoskModels = getVoskModels;
      setVoskModelStatus = setVoskModelStatus;
    },
  }));

  const transcriptionMessages$ = new Subject<TranscriptionMessage>();
  const stopTranscription = jest_fn<VoskClientType['stopTranscription']>().mockName('stopTranscription');
  const client = {
    startTranscription: jest_fn<VoskClientType['startTranscription']>()
      .mockName('startTranscription')
      .mockReturnValue(transcriptionMessages$),
    stopTranscription,
    audioDeviceIndex: -1,
  } as unknown as VoskClientType;
  const {
    CreateVoskCliClient: mockedCreateVoskCliClient,
    VoskClient: mockedVoskClient,
  } = require('./VoskClient');
  mockedCreateVoskCliClient.mockReturnValue(client);

  // Apply mock overrides for listAudioDevices
  if (options.mockOverrides?.listAudioDevices) {
    mockedVoskClient.listAudioDevices.mockReturnValue(options.mockOverrides.listAudioDevices);
  }

  const TranscriptionService = require('./transcription')
    .TranscriptionService as typeof TranscriptionServiceType;

  // 親クラスを PersistentStatefulService から StatefulService に差し替えている関係で初期ステートをつなぎ替える必要がある
  // @ts-expect-error: initialState is readonly, but we need to override it for testing
  TranscriptionService.initialState = TranscriptionService.defaultState;

  const instance = TranscriptionService.instance as TranscriptionServiceType;
  instance.updateAudioDevices();
  // Trigger activeness check after initialization
  instance['updateActiveness$'].next();

  return {
    TranscriptionService,
    instance,
    getVoskModelStatus: getVoskModelStatus!,
    client: client!,
    stopTranscription: stopTranscription!,
    transcriptionMessages$: transcriptionMessages$!,
    setVoskModelStatus: setVoskModelStatus!,
    audioSourceUpdated,
  };
}

describe('TranscriptionService', () => {
  it('should be created', () => {
    const { instance, TranscriptionService } = prepare();
    expect(instance).toBeInstanceOf(TranscriptionService);
  });

  describe('setEnabled', () => {
    const scenarios = [
      ['model not downloaded', { audioDeviceId: 'test-device' }, false],
      ['no devices available', { modelDownloaded: true, emptyDevices: true }, false],
      [
        'model downloaded and device set',
        { modelDownloaded: true, audioDeviceId: 'test-device' },
        true,
      ],
      ['auto-select device when available', { modelDownloaded: true }, true],
    ] as const;

    scenarios.forEach(([desc, setup, shouldStart]) => {
      it(
        `should ${shouldStart ? '' : 'not '}activate when ${desc}`,
        withClock(async (clock) => {
          const { instance, client } = setupTranscription(setup);
          instance.setEnabled(true);
          await clock.tickAsync(0);
          if (shouldStart) {
            expect(client.startTranscription).toHaveBeenCalled();
          } else {
            expect(client.startTranscription).not.toHaveBeenCalled();
          }
        }),
      );
    });

    it(
      'should not activate if audio device manually cleared',
      withClock(async (clock) => {
        const { instance, getVoskModelStatus, client } = prepare();
        const { VoskClient: mockedVoskClient } = require('./VoskClient');
        mockedVoskClient.listAudioDevices.mockReturnValue(emptyDeviceList);

        instance.updateAudioDevices();
        instance.setAudioDeviceId(null);
        getVoskModelStatus.mockReturnValue({ state: 'downloaded' });
        instance.setEnabled(true);
        await clock.tickAsync(0);
        expect(client.startTranscription).not.toHaveBeenCalled();
      }),
    );

    it(
      'should deactivate when setEnabled(false)',
      withClock(async (clock) => {
        const { instance, client, stopTranscription } = setupTranscription({
          modelDownloaded: true,
          audioDeviceId: 'test-device',
        });
        instance.setEnabled(true);
        await clock.tickAsync(0);
        instance.setEnabled(false);
        await clock.tickAsync(0);
        expect(stopTranscription).toHaveBeenCalled();
      }),
    );
  });

  describe('activeStatus', () => {
    it(
      'should return "disabled" when service is not enabled',
      withClock(async (clock) => {
        const { instance } = setupTranscription({
          modelDownloaded: true,
          audioDeviceId: 'test-device',
        });
        expect(instance.activeStatus()).toBe('disabled');
      }),
    );

    it(
      'should return "noAudioDevice" when no audio devices available',
      withClock(async (clock) => {
        const { instance } = setupTranscription({ modelDownloaded: true, emptyDevices: true });
        instance.setEnabled(true);
        await clock.tickAsync(0);
        expect(instance.activeStatus()).toBe('noAudioDevice');
      }),
    );

    it(
      'should return "noModelDownloaded" when no models are downloaded',
      withClock(async (clock) => {
        const { instance } = setupTranscription({ audioDeviceId: 'test-device' });
        instance.setEnabled(true);
        await clock.tickAsync(0);
        expect(instance.activeStatus()).toBe('noModelDownloaded');
      }),
    );

    it(
      'should return "noVoskModel" when voskModelName is null/undefined but has downloaded models',
      withClock(async (clock) => {
        const { instance } = setupTranscription({ audioDeviceId: 'test-device' });

        // First set up a scenario where we have some downloaded models
        const mockModelsManager = instance['modelsManager'];
        jest
          .spyOn(mockModelsManager, 'getVoskModels')
          .mockReturnValue([
            { name: 'other-model', description: 'Other', status: { state: 'downloaded' } },
          ]);

        // But set the selected model to null (which will be undefined)
        jest.spyOn(mockModelsManager, 'getVoskModels').mockReturnValue([]);
        instance.setModelName(null);

        // Now mock hasAnyDownloadedModel to return true
        jest.spyOn(instance, 'hasAnyDownloadedModel').mockReturnValue(true);

        instance.setEnabled(true);
        await clock.tickAsync(0);
        expect(instance.activeStatus()).toBe('noVoskModel');
      }),
    );

    it(
      'should return "noVoskModel" when selected model is not downloaded but others are',
      withClock(async (clock) => {
        const { instance } = setupTranscription({ audioDeviceId: 'test-device' });

        // Mock that we have some downloaded models, so hasAnyDownloadedModel returns true
        jest.spyOn(instance, 'hasAnyDownloadedModel').mockReturnValue(true);

        // But the specific selected model is not downloaded
        const mockModelsManager = instance['modelsManager'];
        jest
          .spyOn(mockModelsManager, 'getVoskModelStatus')
          .mockReturnValue({ state: 'not_downloaded' });

        instance.setEnabled(true);
        await clock.tickAsync(0);
        expect(instance.activeStatus()).toBe('noVoskModel');
      }),
    );

    it(
      'should return "active" when all conditions are met',
      withClock(async (clock) => {
        const { instance } = setupTranscription({
          modelDownloaded: true,
          audioDeviceId: 'test-device',
        });
        instance.setEnabled(true);
        await clock.tickAsync(0);
        expect(instance.activeStatus()).toBe('active');
      }),
    );

    it(
      'should emit activeStatus changes through observable',
      withClock(async (clock) => {
        const { instance } = setupTranscription({
          modelDownloaded: true,
          audioDeviceId: 'test-device',
        });
        const statusSpy = jest_fn().mockName('activeStatusSpy');
        instance.activeStatus$.subscribe(statusSpy);

        // Initial status should be 'disabled'
        expect(statusSpy).toHaveBeenLastCalledWith('disabled');

        // Enable should change to 'active'
        instance.setEnabled(true);
        await clock.tickAsync(0);
        expect(statusSpy).toHaveBeenLastCalledWith('active');

        // Disable should change back to 'disabled'
        instance.setEnabled(false);
        await clock.tickAsync(0);
        expect(statusSpy).toHaveBeenLastCalledWith('disabled');
      }),
    );

    it(
      'should transition through different states correctly',
      withClock(async (clock) => {
        const { instance } = setupTranscription({ emptyDevices: true });
        const statusSpy = jest_fn().mockName('activeStatusSpy');
        instance.activeStatus$.subscribe(statusSpy);

        // Start disabled
        expect(instance.activeStatus()).toBe('disabled');

        // Enable with no devices -> noAudioDevice
        instance.setEnabled(true);
        await clock.tickAsync(0);
        expect(instance.activeStatus()).toBe('noAudioDevice');

        // Add devices but no model -> noModelDownloaded
        const { VoskClient: mockedVoskClient } = require('./VoskClient');
        mockedVoskClient.listAudioDevices.mockReturnValue(testDeviceList);
        instance.updateAudioDevices();
        await clock.tickAsync(0);
        expect(instance.activeStatus()).toBe('noModelDownloaded');

        // Add downloaded model -> active
        const mockModelsManager = instance['modelsManager'];
        jest
          .spyOn(mockModelsManager, 'getVoskModels')
          .mockReturnValue([
            { name: VOSK_MODEL_NAME, description: 'Test', status: { state: 'downloaded' } },
          ]);
        jest
          .spyOn(mockModelsManager, 'getVoskModelStatus')
          .mockReturnValue({ state: 'downloaded' });
        jest.spyOn(instance, 'hasAnyDownloadedModel').mockReturnValue(true);

        instance['setModelStatus'](VOSK_MODEL_NAME, { state: 'downloaded' as const });
        await clock.tickAsync(0);
        expect(instance.activeStatus()).toBe('active');

        // Remove model -> noVoskModel
        jest
          .spyOn(mockModelsManager, 'getVoskModelStatus')
          .mockReturnValue({ state: 'not_downloaded' });
        // Still has downloaded models in general, so hasAnyDownloadedModel returns true
        jest.spyOn(instance, 'hasAnyDownloadedModel').mockReturnValue(true);
        instance['setModelStatus'](VOSK_MODEL_NAME, { state: 'not_downloaded' as const });
        await clock.tickAsync(0);
        expect(instance.activeStatus()).toBe('noVoskModel');
      }),
    );
  });

  describe('text processing', () => {
    it(
      'should initialize text with placeholder when initializeText() is called',
      withClock(async (clock) => {
        const { instance } = setupTranscription({
          modelDownloaded: true,
          audioDeviceId: 'test-device',
        });
        instance.setEnabled(true);
        await clock.tickAsync(0);

        const linesSpy = jest_fn().mockName('linesSpy');
        instance.lines$.subscribe(linesSpy);

        // Call initializeText()
        instance.initializeText();
        await clock.tickAsync(0);

        // Should set texts to placeholder message
        expect(linesSpy).toHaveBeenLastCalledWith({
          texts: ['settings.transcription.placeholder'],
          partial: '',
        });
      }),
    );

    it(
      'should replace placeholder with actual transcription text',
      withClock(async (clock) => {
        const { instance, transcriptionMessages$ } = setupTranscription({
          modelDownloaded: true,
          audioDeviceId: 'test-device',
        });
        instance.setEnabled(true);
        await clock.tickAsync(0);

        const linesSpy = jest_fn().mockName('linesSpy');
        instance.lines$.subscribe(linesSpy);

        // Initialize with placeholder
        instance.initializeText();
        await clock.tickAsync(0);
        expect(linesSpy).toHaveBeenLastCalledWith({
          texts: ['settings.transcription.placeholder'],
          partial: '',
        });

        // Receive actual transcription text
        transcriptionMessages$.next({ text: 'こんにちは世界' });
        await clock.tickAsync(0);

        // Placeholder should be replaced with actual text
        expect(linesSpy).toHaveBeenLastCalledWith({
          texts: ['settings.transcription.placeholder', 'こんにちは世界'],
          partial: '',
        });
      }),
    );

    it(
      'should process partial and final text',
      withClock(async (clock) => {
        const { instance, transcriptionMessages$ } = setupTranscription({
          modelDownloaded: true,
          audioDeviceId: 'test-device',
        });
        instance.setEnabled(true);
        await clock.tickAsync(0);

        const textSpy = jest_fn().mockName('textSpy');
        const partialSpy = jest_fn().mockName('partialSpy');
        const linesSpy = jest_fn().mockName('linesSpy');
        instance.text$.subscribe(textSpy);
        instance.partial$.subscribe(partialSpy);
        instance.lines$.subscribe(linesSpy);

        transcriptionMessages$.next({ partial: 'こんにちは' });
        await clock.tickAsync(0);
        expect(partialSpy).toHaveBeenLastCalledWith('こんにちは');
        expect(linesSpy).toHaveBeenLastCalledWith({ texts: [], partial: 'こんにちは...' });

        transcriptionMessages$.next({ text: 'こんにちは世界' });
        await clock.tickAsync(0);
        expect(textSpy).toHaveBeenCalledWith(expect.objectContaining({ text: 'こんにちは世界' }));
        expect(linesSpy).toHaveBeenLastCalledWith({ texts: ['こんにちは世界'], partial: '' });
      }),
    );

    it(
      'should handle text file line limit and time to live',
      withClock(async (clock) => {
        const { instance, transcriptionMessages$ } = setupTranscription({
          modelDownloaded: true,
          audioDeviceId: 'test-device',
        });
        instance.setEnabled(true);
        await clock.tickAsync(0);

        instance.setTextFileMaxLine(2);
        instance.setTextFileLineTimeToLive(1000);

        const linesSpy = jest_fn().mockName('linesSpy');
        instance.lines$.subscribe(linesSpy);

        // time=0: line 1追加（タイマー開始: 1000msで削除）
        transcriptionMessages$.next({ text: 'line 1' });
        await clock.tickAsync(0);
        expect(linesSpy).toHaveBeenLastCalledWith({ texts: ['line 1'], partial: '' });

        // time=0: line 2追加（タイマー開始: 1000msで削除）
        transcriptionMessages$.next({ text: 'line 2' });
        await clock.tickAsync(0);
        expect(linesSpy).toHaveBeenLastCalledWith({ texts: ['line 1', 'line 2'], partial: '' });

        // time=0: line 3追加（line 1が押し出される、タイマー1キャンセル、タイマー3開始: 1000msで削除）
        transcriptionMessages$.next({ text: 'line 3' });
        await clock.tickAsync(0);
        expect(linesSpy).toHaveBeenLastCalledWith({ texts: ['line 2', 'line 3'], partial: '' });

        // time=1000: タイマー2とタイマー3が同時に完了（両方とも追加から1000ms後）
        await clock.tickAsync(1000);
        expect(linesSpy).toHaveBeenLastCalledWith({ texts: [], partial: '' });
      }),
    );

    it(
      'should cancel oldest timer when line is pushed out by max line limit',
      withClock(async (clock) => {
        const { instance, transcriptionMessages$ } = setupTranscription({
          modelDownloaded: true,
          audioDeviceId: 'test-device',
        });
        instance.setEnabled(true);
        await clock.tickAsync(0);

        instance.setTextFileMaxLine(2); // 最大2行
        instance.setTextFileLineTimeToLive(5000); // TTL=5秒

        const linesSpy = jest_fn().mockName('linesSpy');
        instance.lines$.subscribe(linesSpy);

        // time=0: line 1追加 → タイマー1開始（5秒後に削除予定）
        transcriptionMessages$.next({ text: 'line 1' });
        await clock.tickAsync(0);
        expect(linesSpy).toHaveBeenLastCalledWith({ texts: ['line 1'], partial: '' });

        // time=1000: line 2追加 → タイマー2開始（6秒に削除予定）
        await clock.tickAsync(1000);
        transcriptionMessages$.next({ text: 'line 2' });
        await clock.tickAsync(0);
        expect(linesSpy).toHaveBeenLastCalledWith({ texts: ['line 1', 'line 2'], partial: '' });

        // time=2000: line 3追加 → line 1が押し出される、タイマー1キャンセル、タイマー3開始（7秒に削除予定）
        await clock.tickAsync(1000);
        transcriptionMessages$.next({ text: 'line 3' });
        await clock.tickAsync(0);
        expect(linesSpy).toHaveBeenLastCalledWith({ texts: ['line 2', 'line 3'], partial: '' });

        // time=5000: タイマー1は既にキャンセルされているので何も起こらない
        await clock.tickAsync(3000);
        expect(linesSpy).toHaveBeenLastCalledWith({ texts: ['line 2', 'line 3'], partial: '' });

        // time=6000: タイマー2完了 → line 2削除（正しい）
        await clock.tickAsync(1000);
        expect(linesSpy).toHaveBeenLastCalledWith({ texts: ['line 3'], partial: '' });

        // time=7000: タイマー3完了 → line 3削除（正しい）
        await clock.tickAsync(1000);
        expect(linesSpy).toHaveBeenLastCalledWith({ texts: [], partial: '' });
      }),
    );

    it(
      'should handle multiple line pushouts correctly',
      withClock(async (clock) => {
        const { instance, transcriptionMessages$ } = setupTranscription({
          modelDownloaded: true,
          audioDeviceId: 'test-device',
        });
        instance.setEnabled(true);
        await clock.tickAsync(0);

        instance.setTextFileMaxLine(2); // 最大2行
        instance.setTextFileLineTimeToLive(5000); // TTL=5秒

        const linesSpy = jest_fn().mockName('linesSpy');
        instance.lines$.subscribe(linesSpy);

        // time=0: line 1, 2追加
        transcriptionMessages$.next({ text: 'line 1' });
        await clock.tickAsync(0);
        transcriptionMessages$.next({ text: 'line 2' });
        await clock.tickAsync(0);

        // time=1000: line 3追加 → line 1押し出し、timer1キャンセル
        await clock.tickAsync(1000);
        transcriptionMessages$.next({ text: 'line 3' });
        await clock.tickAsync(0);
        expect(linesSpy).toHaveBeenLastCalledWith({ texts: ['line 2', 'line 3'], partial: '' });
        expect(instance['timerSubscriptions'].length).toBe(2); // timer2, timer3

        // time=2000: line 4追加 → line 2押し出し、timer2キャンセル
        await clock.tickAsync(1000);
        transcriptionMessages$.next({ text: 'line 4' });
        await clock.tickAsync(0);
        expect(linesSpy).toHaveBeenLastCalledWith({ texts: ['line 3', 'line 4'], partial: '' });
        expect(instance['timerSubscriptions'].length).toBe(2); // timer3, timer4

        // time=3000: line 5追加 → line 3押し出し、timer3キャンセル
        await clock.tickAsync(1000);
        transcriptionMessages$.next({ text: 'line 5' });
        await clock.tickAsync(0);
        expect(linesSpy).toHaveBeenLastCalledWith({ texts: ['line 4', 'line 5'], partial: '' });
        expect(instance['timerSubscriptions'].length).toBe(2); // timer4, timer5

        // time=7000: timer4完了（line 4追加から5秒後）
        await clock.tickAsync(4000);
        expect(linesSpy).toHaveBeenLastCalledWith({ texts: ['line 5'], partial: '' });
        expect(instance['timerSubscriptions'].length).toBe(1); // timer5のみ

        // time=8000: timer5完了（line 5追加から5秒後）
        await clock.tickAsync(1000);
        expect(linesSpy).toHaveBeenLastCalledWith({ texts: [], partial: '' });
        expect(instance['timerSubscriptions'].length).toBe(0);
      }),
    );

    it(
      'should cancel all timers when deactivating',
      withClock(async (clock) => {
        const { instance, transcriptionMessages$ } = setupTranscription({
          modelDownloaded: true,
          audioDeviceId: 'test-device',
        });
        instance.setEnabled(true);
        await clock.tickAsync(0);

        instance.setTextFileMaxLine(10);
        instance.setTextFileLineTimeToLive(5000);

        const linesSpy = jest_fn().mockName('linesSpy');
        instance.lines$.subscribe(linesSpy);

        // 複数の行を追加してタイマーを開始
        transcriptionMessages$.next({ text: 'line 1' });
        await clock.tickAsync(0);
        transcriptionMessages$.next({ text: 'line 2' });
        await clock.tickAsync(0);
        transcriptionMessages$.next({ text: 'line 3' });
        await clock.tickAsync(0);

        expect(linesSpy).toHaveBeenLastCalledWith({
          texts: ['line 1', 'line 2', 'line 3'],
          partial: '',
        });

        // 実行中のタイマー数を確認
        expect(instance['timerSubscriptions'].length).toBe(3);

        // removeLineSubject$の発火を監視
        const removeLineSpy = jest.spyOn(instance['removeLineSubject$'], 'next');

        // サービスを無効化（deactivate）
        instance.setEnabled(false);
        await clock.tickAsync(0);

        // タイマーがすべてキャンセルされたことを確認
        expect(instance['timerSubscriptions'].length).toBe(0);

        // 5秒経過してもremoveLineSubject$が発火しない（タイマーがキャンセルされている証拠）
        await clock.tickAsync(5000);
        expect(removeLineSpy).not.toHaveBeenCalled();
      }),
    );

    it(
      'should write to text file when enabled',
      withClock(async (clock) => {
        const { instance, transcriptionMessages$ } = setupTranscription({
          modelDownloaded: true,
          audioDeviceId: 'test-device',
        });
        const { promises } = require('node:fs');

        instance.setEnabled(true);
        instance.setTextFileEnabled(true);
        instance.setTextFilePath('/fake/transcription.txt');
        await clock.tickAsync(0);

        transcriptionMessages$.next({ text: 'hello world' });
        await clock.tickAsync(0);

        expect(promises.writeFile).toHaveBeenCalledWith(
          '/fake/transcription.txt',
          'hello world',
          'utf-8',
        );
      }),
    );

    it(
      'should disable text file writing on error',
      withClock(async (clock) => {
        const { instance, transcriptionMessages$ } = setupTranscription({
          modelDownloaded: true,
          audioDeviceId: 'test-device',
        });
        const { promises } = require('node:fs');
        promises.writeFile.mockRejectedValue(new Error('Disk full'));

        instance.setEnabled(true);
        instance.setTextFileEnabled(true);
        instance.setTextFilePath('/fake/transcription.txt');
        const spy = jest.spyOn(instance, 'setTextFileEnabled');
        await clock.tickAsync(0);

        transcriptionMessages$.next({ text: 'hello world' });
        await clock.tickAsync(0);

        expect(spy).toHaveBeenCalledWith(false);
      }),
    );
  });

  describe('audio device management', () => {
    it('should get audio device list', () => {
      expect(setupTranscription().instance.getAudioDeviceList()).toEqual([
        { id: 'test-device', name: 'Test Device' },
      ]);
      expect(setupTranscription({ emptyDevices: true }).instance.getAudioDeviceList()).toEqual([]);
    });

    it('should get audio device index correctly', () => {
      const { instance } = setupTranscription();
      expect(instance.getAudioDeviceIndex('test-device', -1)).toBe(0);
      expect(instance.getAudioDeviceIndex('nonexistent', -1)).toBe(-1);
      expect(instance.getAudioDeviceIndex(null, -1)).toBe(-1);
    });

    it('should set and correct audio device ID', () => {
      const { instance } = setupTranscription();

      instance.setAudioDeviceId('test-device');
      expect(instance.state.audioDeviceId).toBe('test-device');

      instance.setAudioDeviceId('invalid-device');
      expect(instance.state.audioDeviceId).toBe('test-device');

      instance.setAudioDeviceId(null);
      expect(instance.state.audioDeviceId).toBe('test-device');
    });

    it('should auto-select first available device', () => {
      // With devices available, should auto-select first
      expect(setupTranscription().instance.state.audioDeviceId).toBe('test-device');

      // With empty device list, still gets auto-corrected to first available in mocked list
      expect(setupTranscription({ emptyDevices: true }).instance.state.audioDeviceId).toBe(
        'test-device',
      );
    });

    it('should handle updateAudioDevices error gracefully', () => {
      const { instance } = setupTranscription();
      const { VoskClient: mockedVoskClient } = require('./VoskClient');
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      mockedVoskClient.listAudioDevices.mockImplementation(() => {
        throw new Error('Audio device enumeration failed');
      });

      expect(() => instance.updateAudioDevices()).not.toThrow();
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to create Vosk CLI client:',
        expect.any(Error),
      );
      consoleSpy.mockRestore();
    });

    it('should initialize with default audio device', () => {
      const { instance } = setupTranscription();
      expect(instance.getAudioDeviceList().length).toBeGreaterThan(0);
      expect(instance.state.audioDeviceId).toBe('test-device');
    });

    it('should prefer microphone (input) over desktop audio (output) as default', () => {
      // vosk-cli リストの先頭が output、2番目が input のケース
      const { instance } = prepare({
        mockOverrides: {
          listAudioDevices: {
            version: '1',
            devices: [
              { id: 'desktop-device', name: 'Desktop Audio', index: 0 },
              { id: 'mic-device', name: 'Microphone', index: 1 },
            ],
          },
          obsAudioDevices: [
            { id: 'desktop-device', description: 'Desktop Audio', type: 'output' },
            { id: 'mic-device', description: 'Microphone', type: 'input' },
          ],
        },
      });
      expect(instance.state.audioDeviceId).toBe('mic-device');
    });

    it('should fall back to first device when no input device found', () => {
      // vosk-cli リストに input が1つも無いケース
      const { instance } = prepare({
        mockOverrides: {
          listAudioDevices: {
            version: '1',
            devices: [
              { id: 'desktop-device', name: 'Desktop Audio', index: 0 },
            ],
          },
          obsAudioDevices: [
            { id: 'desktop-device', description: 'Desktop Audio', type: 'output' },
          ],
        },
      });
      expect(instance.state.audioDeviceId).toBe('desktop-device');
    });

    it('should fall back to first device when getDevices returns empty', () => {
      // AudioService.getDevices() が空のケース
      const { instance } = prepare({
        mockOverrides: {
          obsAudioDevices: [],
        },
      });
      expect(instance.state.audioDeviceId).toBe('test-device');
    });

    it('should fall back to first device when getDevices throws', () => {
      // AudioService.getDevices() が例外を投げるケース（OBS 未初期化など）
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const { instance } = prepare({
        mockOverrides: {
          listAudioDevices: {
            version: '1',
            devices: [
              { id: 'desktop-device', name: 'Desktop Audio', index: 0 },
              { id: 'mic-device', name: 'Microphone', index: 1 },
            ],
          },
          audioServiceOverride: {
            getDevices: jest_fn<() => never>()
              .mockName('getDevices')
              .mockImplementation(() => { throw new Error('OBS not initialized'); }),
          },
        },
      });
      // 先頭デバイスにフォールバックし、例外が外に漏れないこと
      expect(instance.state.audioDeviceId).toBe('desktop-device');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to get OBS audio devices'),
        expect.any(Error),
      );
      consoleSpy.mockRestore();
    });
  });

  describe('audio device muted stream', () => {
    it('should call getSourceByDeviceId with wasapi_input_capture only', () => {
      // getSourceByDeviceId は常に wasapi_input_capture のみで呼ばれること
      const mockedGetSourceByDeviceId = jest_fn()
        .mockName('getSourceByDeviceId')
        .mockReturnValue(undefined);
      const { audioSourceUpdated } = prepare({
        mockOverrides: {
          audioServiceOverride: { getSourceByDeviceId: mockedGetSourceByDeviceId },
        },
      });
      mockedGetSourceByDeviceId.mockClear();
      audioSourceUpdated.next(undefined);

      const callSourceTypes = mockedGetSourceByDeviceId.mock.calls.map(([, , type]) => type);
      expect(callSourceTypes.every((t) => t === 'wasapi_input_capture')).toBe(true);
    });

    it('should return muted=true when exact device_id match is muted', () => {
      // OBS device_id が完全一致するソースがミュートされていればミュート検出
      const mockedGetSourceByDeviceId = jest_fn()
        .mockName('getSourceByDeviceId')
        .mockImplementation((deviceId: string, isDefault: boolean) => {
          if (!isDefault && deviceId === 'test-device') return { muted: true };
          return undefined;
        });
      const { instance, audioSourceUpdated } = prepare({
        mockOverrides: {
          audioServiceOverride: { getSourceByDeviceId: mockedGetSourceByDeviceId },
        },
      });
      instance.setAudioDeviceId('test-device');

      let muted: boolean | undefined;
      instance['audioDeviceMuted$'].subscribe((v) => { muted = v; });
      audioSourceUpdated.next(undefined);
      expect(muted).toBe(true);
    });

    it('should detect mute via device_id=default fallback when exact match fails', () => {
      // 完全一致なし → isDefault=true フォールバックで device_id='default' ソースを検出
      const mockedGetSourceByDeviceId = jest_fn()
        .mockName('getSourceByDeviceId')
        .mockImplementation((deviceId: string, isDefault: boolean, sourceType: string) => {
          if (!isDefault) return undefined;
          if (isDefault && sourceType === 'wasapi_input_capture') return { muted: true };
          return undefined;
        });
      const { instance, audioSourceUpdated } = prepare({
        mockOverrides: {
          audioServiceOverride: { getSourceByDeviceId: mockedGetSourceByDeviceId },
        },
      });
      instance.setAudioDeviceId('test-device');

      let muted: boolean | undefined;
      instance['audioDeviceMuted$'].subscribe((v) => { muted = v; });
      audioSourceUpdated.next(undefined);
      expect(muted).toBe(true);
    });

    it('should not pick up desktop audio mute when mic is selected (regression)', () => {
      // リグレッション: デスクトップ音声がミュートされても文字起こしがミュートにならないこと
      const mockedGetSourceByDeviceId = jest_fn()
        .mockName('getSourceByDeviceId')
        .mockImplementation((_deviceId: string, _isDefault: boolean, sourceType: string) => {
          // wasapi_input_capture 以外(=output)がヒットしたらミュート扱いにしてテスト失敗させる
          if (sourceType !== 'wasapi_input_capture') return { muted: true };
          return undefined; // マイクはアンミュート
        });
      const { instance, audioSourceUpdated } = prepare({
        mockOverrides: {
          listAudioDevices: {
            version: '1',
            devices: [
              { id: 'desktop-device', name: 'Desktop Audio', index: 0 },
              { id: 'mic-device', name: 'Microphone', index: 1 },
            ],
          },
          obsAudioDevices: [
            { id: 'desktop-device', description: 'Desktop Audio', type: 'output' },
            { id: 'mic-device', description: 'Microphone', type: 'input' },
          ],
          audioServiceOverride: { getSourceByDeviceId: mockedGetSourceByDeviceId },
        },
      });

      expect(instance.state.audioDeviceId).toBe('mic-device');

      let muted: boolean | undefined;
      instance['audioDeviceMuted$'].subscribe((v) => { muted = v; });
      audioSourceUpdated.next(undefined);

      // sourceType フィルタによりデスクトップ音声ソースは除外され、ミュートは false のまま
      expect(muted).toBe(false);
      const callsWithWrong = mockedGetSourceByDeviceId.mock.calls.filter(
        ([, , type]) => type !== 'wasapi_input_capture',
      );
      expect(callsWithWrong).toHaveLength(0);
    });
  });

  describe('model management', () => {
    it('should download a model', async () => {
      const { instance, setVoskModelStatus } = setupTranscription();
      const { downloadAndUnzip } = require('./downloadAndUnzip');
      downloadAndUnzip.mockResolvedValue(undefined);

      await instance.startDownloadVoskModel(VOSK_MODEL_NAME);

      expect(setVoskModelStatus).toHaveBeenCalledWith(VOSK_MODEL_NAME, { state: 'downloading' });
      expect(setVoskModelStatus).toHaveBeenLastCalledWith(VOSK_MODEL_NAME, { state: 'downloaded' });
      expect(downloadAndUnzip).toHaveBeenCalled();
    });

    it(
      'should cancel download and set model status to cancelled',
      withClock(async (clock) => {
        const { instance, setVoskModelStatus } = setupTranscription();
        const { downloadAndUnzip, CancelledError } = require('./downloadAndUnzip');

        let rejectDownload: (error: Error) => void;

        // Mock downloadAndUnzip to return a promise we can control
        downloadAndUnzip.mockImplementation(() => {
          return new Promise((resolve, reject) => {
            rejectDownload = reject;
          });
        });

        const downloadPromise = instance.startDownloadVoskModel(VOSK_MODEL_NAME);

        // Verify download started
        expect(setVoskModelStatus).toHaveBeenCalledWith(VOSK_MODEL_NAME, { state: 'downloading' });

        // Cancel the download
        const wasCancelled = instance.cancelDownloadVoskModel(VOSK_MODEL_NAME);
        expect(wasCancelled).toBe(true);

        // Simulate downloadAndUnzip throwing CancelledError
        rejectDownload!(new CancelledError());

        // Wait for download promise to complete
        await downloadPromise;
        await clock.tickAsync(0);

        // Verify status was set to cancelled
        expect(setVoskModelStatus).toHaveBeenCalledWith(VOSK_MODEL_NAME, { state: 'cancelled' });

        // Advance time by 3 seconds to trigger auto-reset
        await clock.tickAsync(3000);

        // Verify status was reset to not_downloaded
        expect(setVoskModelStatus).toHaveBeenCalledWith(VOSK_MODEL_NAME, {
          state: 'not_downloaded',
        });
      }),
    );

    it('should return false when cancelling with no download in progress', () => {
      const { instance } = setupTranscription();
      const wasCancelled = instance.cancelDownloadVoskModel(VOSK_MODEL_NAME);
      expect(wasCancelled).toBe(false);
    });

    it('should prevent downloading the same model multiple times', async () => {
      const { instance } = setupTranscription();
      const { downloadAndUnzip } = require('./downloadAndUnzip');

      let resolveDownload: (value?: unknown) => void;

      // Mock downloadAndUnzip to return a promise we can control
      downloadAndUnzip.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveDownload = resolve;
          }),
      );

      // Start first download
      const firstDownload = instance.startDownloadVoskModel(VOSK_MODEL_NAME);

      // Try to start the same model download again
      await expect(instance.startDownloadVoskModel(VOSK_MODEL_NAME)).rejects.toThrow(
        `Model ${VOSK_MODEL_NAME} is already being downloaded`,
      );

      // Complete first download
      resolveDownload!();
      await firstDownload;
    });

    it('should allow downloading different models simultaneously', async () => {
      const { instance } = setupTranscription();
      const { downloadAndUnzip } = require('./downloadAndUnzip');

      const resolvers: ((value?: unknown) => void)[] = [];

      // Mock downloadAndUnzip to return a promise we can control
      downloadAndUnzip.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolvers.push(resolve);
          }),
      );

      // Start first download
      const firstDownload = instance.startDownloadVoskModel(VOSK_MODEL_NAME);

      // Start second download of different model - should succeed
      const secondDownload = instance.startDownloadVoskModel(VOSK_MODEL_NAME_2);

      // Complete both downloads
      resolvers[0]!();
      resolvers[1]!();
      await firstDownload;
      await secondDownload;

      expect(downloadAndUnzip).toHaveBeenCalledTimes(2);
    });

    it(
      'should delete a model and deactivate service',
      withClock(async (clock) => {
        const { instance, stopTranscription, setVoskModelStatus } = setupTranscription({
          modelDownloaded: true,
          audioDeviceId: 'test-device',
        });

        instance.setEnabled(true);
        await clock.tickAsync(0);

        await instance.deleteVoskModel(VOSK_MODEL_NAME);

        expect(setVoskModelStatus).toHaveBeenLastCalledWith(VOSK_MODEL_NAME, {
          state: 'not_downloaded',
        });
        expect(stopTranscription).toHaveBeenCalled();
        expect(require('node:fs').promises.rmdir).toHaveBeenCalled();
      }),
    );
  });

  describe('model switching', () => {
    it(
      'should deactivate and reactivate with new model when switching models',
      withClock(async (clock) => {
        const { instance, getVoskModelStatus, stopTranscription } = prepare();
        const { CreateVoskCliClient: mockedCreateVoskCliClient } = require('./VoskClient');

        // Mock two downloaded models
        const downloadedStatus = { state: 'downloaded' as const };
        const mockModelsManager = instance['modelsManager'];
        jest.spyOn(mockModelsManager, 'getVoskModels').mockReturnValue([
          { name: VOSK_MODEL_NAME, description: 'Small', status: downloadedStatus },
          { name: VOSK_MODEL_NAME_2, description: 'Large', status: downloadedStatus },
        ]);

        // Set both models as downloaded
        getVoskModelStatus.mockImplementation((modelName: string) => {
          if (modelName === VOSK_MODEL_NAME || modelName === VOSK_MODEL_NAME_2) {
            return downloadedStatus;
          }
          return { state: 'not_downloaded' };
        });

        instance['setModelStatus'](VOSK_MODEL_NAME, downloadedStatus);
        instance['setModelStatus'](VOSK_MODEL_NAME_2, downloadedStatus);

        // Set audio device and enable with first model
        instance.setAudioDeviceId('test-device');
        instance.setEnabled(true);
        await clock.tickAsync(0);

        // Verify first model was used
        expect(mockedCreateVoskCliClient).toHaveBeenCalledTimes(1);
        expect(mockedCreateVoskCliClient).toHaveBeenCalledWith({
          voskCliPath: '/fake/vosk-cli',
          modelPath: `/fake/path/vosk-model/${VOSK_MODEL_NAME}`,
        });

        // Clear mock to track new calls
        mockedCreateVoskCliClient.mockClear();
        stopTranscription.mockClear();

        // Switch to second model
        instance.setModelName(VOSK_MODEL_NAME_2);
        await clock.tickAsync(0);

        // Verify old client was stopped
        expect(stopTranscription).toHaveBeenCalledTimes(1);

        // Verify new client was created with second model
        expect(mockedCreateVoskCliClient).toHaveBeenCalledTimes(1);
        expect(mockedCreateVoskCliClient).toHaveBeenCalledWith({
          voskCliPath: '/fake/vosk-cli',
          modelPath: `/fake/path/vosk-model/${VOSK_MODEL_NAME_2}`,
        });

        // Verify new client's startTranscription was called
        const newClient = mockedCreateVoskCliClient.mock.results[0].value;
        expect(newClient.startTranscription).toHaveBeenCalled();
      }),
    );
  });

  describe('setTextFileMaxLine integration', () => {
    it('should call updateTranscriptionLines when setting new value', () => {
      const { instance } = prepare();

      // TranscriptionSourceServiceのupdateTranscriptionLinesをモック
      const mockUpdateTranscriptionLines = jest_fn().mockName('updateTranscriptionLines');
      instance.transcriptionSourceService.updateTranscriptionLines = mockUpdateTranscriptionLines;

      // 行数を変更
      instance.setTextFileMaxLine(5);

      // updateTranscriptionLinesが呼ばれたことを確認
      expect(mockUpdateTranscriptionLines).toHaveBeenCalledTimes(1);
      expect(instance.state.textFileMaxLine).toBe(5);
    });

    it('should update transcription sources when value changes', () => {
      const { instance } = prepare();

      // モックを準備
      const mockUpdateTranscriptionLines = jest_fn().mockName('updateTranscriptionLines');
      instance.transcriptionSourceService.updateTranscriptionLines = mockUpdateTranscriptionLines;

      // 複数回変更
      instance.setTextFileMaxLine(3);
      instance.setTextFileMaxLine(7);
      instance.setTextFileMaxLine(2);

      // 3回呼ばれたことを確認
      expect(mockUpdateTranscriptionLines).toHaveBeenCalledTimes(3);
      expect(instance.state.textFileMaxLine).toBe(2);
    });
  });
});
