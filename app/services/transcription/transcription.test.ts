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
    .mockImplementation(key => key),
}));
jest.mock('./downloadAndUnzip', () => ({
  downloadAndUnzip: jest_fn<typeof downloadAndUnzipType>().mockName('downloadAndUnzip'),
}));
jest.mock('./filterNoiseText', () => ({
  filterNoiseText: jest_fn<typeof filterNoiseTextType>()
    .mockName('filterNoiseText')
    .mockImplementation(text => text),
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
  injectee: {},
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

function prepare(): {
  TranscriptionService: typeof TranscriptionServiceType;
  instance: TranscriptionServiceType;
  getVoskModelStatus: jest.Mock;
  setVoskModelStatus: jest.Mock;
  client: VoskClientType;
  transcriptionMessages$: Subject<TranscriptionMessage>;
  stopTranscription: jest.Mock;
} {
  setup();

  const getVoskModelStatus = jest_fn()
    .mockName('getVoskModelStatus')
    .mockReturnValue({ state: 'not_downloaded' });
  const getVoskModels = jest_fn()
    .mockName('getVoskModels')
    .mockReturnValue([
      {
        name: VOSK_MODEL_NAME,
        description: 'small',
        status: { state: 'not_downloaded' },
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
  const stopTranscription =
    jest_fn<VoskClientType['stopTranscription']>().mockName('stopTranscription');
  const client = {
    startTranscription: jest_fn<VoskClientType['startTranscription']>()
      .mockName('startTranscription')
      .mockReturnValue(transcriptionMessages$),
    stopTranscription,
    audioDeviceIndex: -1,
  } as unknown as VoskClientType;
  const { CreateVoskCliClient: mockedCreateVoskCliClient } = require('./VoskClient');
  mockedCreateVoskCliClient.mockReturnValue(client);

  const TranscriptionService = require('./transcription')
    .TranscriptionService as typeof TranscriptionServiceType;

  // 親クラスを PersistentStatefulService から StatefulService に差し替えている関係で初期ステートをつなぎ替える必要がある
  // @ts-expect-error: initialState is readonly, but we need to override it for testing
  TranscriptionService.initialState = TranscriptionService.defaultState;

  const instance = TranscriptionService.instance as TranscriptionServiceType;
  instance.updateAudioDevices();

  return {
    TranscriptionService,
    instance,
    getVoskModelStatus: getVoskModelStatus!,
    client: client!,
    stopTranscription: stopTranscription!,
    transcriptionMessages$: transcriptionMessages$!,
    setVoskModelStatus: setVoskModelStatus!,
  };
}

describe('TranscriptionService', () => {
  it('should be created', () => {
    const { instance, TranscriptionService } = prepare();
    expect(instance).toBeInstanceOf(TranscriptionService);
  });

  describe('setEnabled', () => {
    let clock: FakeTimers.InstalledClock;
    beforeEach(() => {
      clock = FakeTimers.install();
    });
    afterEach(() => {
      clock.uninstall();
    });

    it('should not activate if model is not downloaded', async () => {
      const { instance, client } = prepare();
      instance.setAudioDeviceId('test-device');
      instance.setEnabled(true);
      await clock.tickAsync(0);
      expect(client.startTranscription).not.toHaveBeenCalled();
    });

    it('should not activate if audio device is not set', async () => {
      const { instance, getVoskModelStatus, client } = prepare();
      getVoskModelStatus.mockReturnValue({ state: 'downloaded' });
      instance.setEnabled(true);
      await clock.tickAsync(0);
      expect(client.startTranscription).not.toHaveBeenCalled();
    });

    it('should activate if enabled, model is downloaded, and audio device is set', async () => {
      const { instance, getVoskModelStatus, client } = prepare();
      getVoskModelStatus.mockReturnValue({ state: 'downloaded' });
      instance.setAudioDeviceId('test-device');
      instance.setEnabled(true);
      await clock.tickAsync(0);
      expect(client.startTranscription).toHaveBeenCalled();
    });

    it('should deactivate when setEnabled(false)', async () => {
      const { instance, getVoskModelStatus, client, stopTranscription } = prepare();
      getVoskModelStatus.mockReturnValue({ state: 'downloaded' });
      instance.setAudioDeviceId('test-device');
      instance.setEnabled(true);
      await clock.tickAsync(0);
      expect(client.startTranscription).toHaveBeenCalledTimes(1);

      instance.setEnabled(false);
      await clock.tickAsync(0);
      expect(stopTranscription).toHaveBeenCalledTimes(1);
    });
  });

  describe('text processing', () => {
    let clock: FakeTimers.InstalledClock;
    beforeEach(() => {
      clock = FakeTimers.install();
    });
    afterEach(() => {
      clock.uninstall();
    });

    it('should process partial and final text', async () => {
      const { instance, transcriptionMessages$, getVoskModelStatus } = prepare();
      getVoskModelStatus.mockReturnValue({ state: 'downloaded' });
      instance.setAudioDeviceId('test-device');
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
      expect(linesSpy).toHaveBeenLastCalledWith({
        texts: [],
        partial: 'こんにちは...',
      });

      transcriptionMessages$.next({ text: 'こんにちは世界' });
      await clock.tickAsync(0);
      expect(textSpy).toHaveBeenCalledTimes(1);
      expect(textSpy).toHaveBeenCalledWith(expect.objectContaining({ text: 'こんにちは世界' }));
      expect(linesSpy).toHaveBeenLastCalledWith({
        texts: ['こんにちは世界'],
        partial: '',
      });
    });

    it('should handle text file line limit and time to live', async () => {
      const { instance, transcriptionMessages$, getVoskModelStatus } = prepare();
      getVoskModelStatus.mockReturnValue({ state: 'downloaded' });
      instance.setAudioDeviceId('test-device');
      instance.setEnabled(true);
      await clock.tickAsync(0);

      instance.setTextFileMaxLine(2);
      instance.setTextFileLineTimeToLive(1000);

      const linesSpy = jest_fn().mockName('linesSpy');
      instance.lines$.subscribe(linesSpy);

      transcriptionMessages$.next({ text: 'line 1' });
      await clock.tickAsync(0);
      expect(linesSpy).toHaveBeenLastCalledWith({ texts: ['line 1'], partial: '' });

      transcriptionMessages$.next({ text: 'line 2' });
      await clock.tickAsync(0);
      expect(linesSpy).toHaveBeenLastCalledWith({ texts: ['line 1', 'line 2'], partial: '' });

      transcriptionMessages$.next({ text: 'line 3' });
      await clock.tickAsync(0);
      expect(linesSpy).toHaveBeenLastCalledWith({ texts: ['line 2', 'line 3'], partial: '' });

      // The first timer started by 'line 1' should fire after 1000ms, removing the first line ('line 2' at this point).
      await clock.tickAsync(1000);
      expect(linesSpy).toHaveBeenLastCalledWith({ texts: ['line 3'], partial: '' });

      // The second timer started by 'line 2' should fire, removing the remaining line.
      await clock.tickAsync(1000);
      expect(linesSpy).toHaveBeenLastCalledWith({ texts: [], partial: '' });
    });

    it('should write to text file when enabled', async () => {
      const { instance, transcriptionMessages$, getVoskModelStatus } = prepare();
      const { promises } = require('node:fs');
      getVoskModelStatus.mockReturnValue({ state: 'downloaded' });
      instance.setAudioDeviceId('test-device');
      instance.setTextFileEnabled(true);
      instance.setTextFilePath('/fake/transcription.txt');
      instance.setEnabled(true);
      await clock.tickAsync(0);

      transcriptionMessages$.next({ text: 'hello world' });
      await clock.tickAsync(0);

      expect(promises.writeFile).toHaveBeenCalledWith(
        '/fake/transcription.txt',
        'hello world',
        'utf-8',
      );
    });

    it('should disable text file writing on error', async () => {
      const { instance, transcriptionMessages$, getVoskModelStatus } = prepare();
      const { promises } = require('node:fs');
      promises.writeFile.mockRejectedValue(new Error('Disk full'));

      getVoskModelStatus.mockReturnValue({ state: 'downloaded' });
      instance.setAudioDeviceId('test-device');
      instance.setTextFileEnabled(true);
      instance.setTextFilePath('/fake/transcription.txt');
      instance.setEnabled(true);
      await clock.tickAsync(0);

      const setTextFileEnabledSpy = jest.spyOn(instance, 'setTextFileEnabled');

      transcriptionMessages$.next({ text: 'hello world' });
      await clock.tickAsync(0);

      expect(promises.writeFile).toHaveBeenCalled();
      expect(setTextFileEnabledSpy).toHaveBeenCalledWith(false);
    });
  });

  describe('model management', () => {
    let clock: FakeTimers.InstalledClock;

    beforeEach(() => {
      clock = FakeTimers.install();
    });

    afterEach(() => {
      clock.uninstall();
    });

    it('should download a model', async () => {
      const { instance, setVoskModelStatus } = prepare();
      const { downloadAndUnzip } = require('./downloadAndUnzip');
      downloadAndUnzip.mockResolvedValue(undefined);

      await instance.startDownloadVoskModel(VOSK_MODEL_NAME);

      expect(setVoskModelStatus).toHaveBeenCalledWith(VOSK_MODEL_NAME, {
        state: 'downloading',
      });
      expect(setVoskModelStatus).toHaveBeenLastCalledWith(VOSK_MODEL_NAME, {
        state: 'downloaded',
      });
      expect(downloadAndUnzip).toHaveBeenCalled();
    });

    it('should delete a model', async () => {
      const { instance, getVoskModelStatus, stopTranscription, setVoskModelStatus } = prepare();
      getVoskModelStatus.mockReturnValue({ state: 'downloaded' });

      // Activate the service first
      instance.setAudioDeviceId('test-device');
      instance.setEnabled(true);
      await clock.tickAsync(0);

      await instance.deleteVoskModel(VOSK_MODEL_NAME);

      expect(setVoskModelStatus).toHaveBeenLastCalledWith(VOSK_MODEL_NAME, {
        state: 'not_downloaded',
      });
      // Deactivate should be called because the active model was deleted
      expect(stopTranscription).toHaveBeenCalled();
      const { promises } = require('node:fs');
      expect(promises.rmdir).toHaveBeenCalled();
    });
  });
});
