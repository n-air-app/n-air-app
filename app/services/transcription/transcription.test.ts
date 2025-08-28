import * as FakeTimers from '@sinonjs/fake-timers';
import { Subject } from 'rxjs';
import { createSetupFunction } from 'util/test-setup';
import type { TranscriptionService as TranscriptionServiceType } from './transcription';

// Mock dependencies
jest.mock('@electron/remote', () => ({
  app: {
    getPath: jest.fn().mockReturnValue('/fake/path'),
  },
}));
jest.mock('node:fs', () => ({
  promises: {
    writeFile: jest.fn().mockResolvedValue(undefined),
    unlink: jest.fn().mockResolvedValue(undefined),
    rmdir: jest.fn().mockResolvedValue(undefined),
  },
  existsSync: jest.fn(),
}));
jest.mock('node:os', () => ({
  tmpdir: jest.fn().mockReturnValue('/fake/tmp'),
}));
jest.mock('node:path', () => ({
  join: (...args: string[]) => args.join('/'),
}));
jest.mock('services/i18n', () => ({
  $t: jest.fn(key => key),
}));
jest.mock('./downloadAndUnzip', () => ({
  downloadAndUnzip: jest.fn(),
}));
jest.mock('./filterNoiseText', () => ({
  filterNoiseText: jest.fn(text => text),
}));
jest.mock('./VoskClient', () => ({
  CreateVoskCliClient: jest.fn(),
  getVoskCliPath: jest.fn().mockReturnValue('/fake/vosk-cli'),
  VoskClient: {
    listAudioDevices: jest.fn().mockReturnValue({
      devices: [{ id: 'test-device', name: 'Test Device' }],
    }),
  },
  isTextTranscriptionMessage: jest.fn(msg => msg.text),
  isPartialTranscriptionMessage: jest.fn(msg => msg.partial),
  isErrorTranscriptionMessage: jest.fn(msg => msg.error),
  isProcessExitedMessage: jest.fn(msg => msg.processExited),
  isInfoTranscriptionMessage: jest.fn(() => false),
  isFormatTranscriptionMessage: jest.fn(() => false),
}));

const setup = createSetupFunction({
  state: {},
  injectee: {},
});

beforeEach(() => {
  jest.doMock('services/core/stateful-service');
  jest.doMock('services/core/injector');
  jest.doMock('services/core/persistent-stateful-service', () => ({
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
  client: {
    startTranscription: jest.Mock;
    stopTranscription: jest.Mock;
    audioDeviceIndex: number;
  };
  transcriptionMessages$: Subject<any>;
  stopTranscription: jest.Mock;
} {
  setup();

  const getVoskModelStatus = jest.fn().mockReturnValue({ state: 'not_downloaded' });
  const getVoskModels = jest.fn().mockReturnValue([
    {
      name: 'vosk-model-small-ja-0.22',
      description: 'small',
      status: { state: 'not_downloaded' },
    },
  ]);
  const setVoskModelStatus = jest.fn();
  jest.doMock('./VoskModelsManager', () => ({
    VOSK_MODEL_NAMES: ['vosk-model-small-ja-0.22', 'vosk-model-ja-0.22'],
    VoskModelsManager: class {
      getVoskModelStatus = getVoskModelStatus;
      getVoskModels = getVoskModels;
      setVoskModelStatus = setVoskModelStatus;
    },
  }));

  const transcriptionMessages$ = new Subject<any>();
  const stopTranscription = jest.fn();
  const client = {
    startTranscription: jest.fn().mockReturnValue(transcriptionMessages$),
    stopTranscription,
    audioDeviceIndex: -1,
  };
  const { CreateVoskCliClient: mockedCreateVoskCliClient } = require('./VoskClient');
  mockedCreateVoskCliClient.mockReturnValue(client);

  const TranscriptionService = require('./transcription')
    .TranscriptionService as typeof TranscriptionServiceType;
  (TranscriptionService as any).initialState = TranscriptionService.defaultState; // override initial state
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

      const textSpy = jest.fn();
      const partialSpy = jest.fn();
      const linesSpy = jest.fn();
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
      const { instance } = prepare();
      instance.setTextFileMaxLine(2);
      instance.setTextFileLineTimeToLive(1000);

      const linesSpy = jest.fn();
      instance.lines$.subscribe(linesSpy);

      // Access private subjects for testing
      const textSubject$ = (instance as any).textSubject$;

      textSubject$.next({ text: 'line 1', timestamp: Date.now() });
      await clock.tickAsync(0);
      expect(linesSpy).toHaveBeenLastCalledWith({ texts: ['line 1'], partial: '' });

      textSubject$.next({ text: 'line 2', timestamp: Date.now() });
      await clock.tickAsync(0);
      expect(linesSpy).toHaveBeenLastCalledWith({ texts: ['line 1', 'line 2'], partial: '' });

      textSubject$.next({ text: 'line 3', timestamp: Date.now() });
      await clock.tickAsync(0);
      expect(linesSpy).toHaveBeenLastCalledWith({ texts: ['line 2', 'line 3'], partial: '' });

      await clock.tickAsync(1000);
      expect(linesSpy).toHaveBeenLastCalledWith({ texts: ['line 3'], partial: '' });
    });
  });

  describe('model management', () => {
    const modelName = 'vosk-model-small-ja-0.22';
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

      await instance.startDownloadVoskModel(modelName);

      expect(setVoskModelStatus).toHaveBeenCalledWith(modelName, {
        state: 'downloading',
      });
      expect(setVoskModelStatus).toHaveBeenLastCalledWith(modelName, {
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

      await instance.deleteVoskModel(modelName);

      expect(setVoskModelStatus).toHaveBeenLastCalledWith(modelName, {
        state: 'not_downloaded',
      });
      // Deactivate should be called because the active model was deleted
      expect(stopTranscription).toHaveBeenCalled();
      const { promises } = require('node:fs');
      expect(promises.rmdir).toHaveBeenCalled();
    });
  });
});
