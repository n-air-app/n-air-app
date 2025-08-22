import * as remote from '@electron/remote';
import { existsSync, promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  BehaviorSubject,
  distinctUntilChanged,
  EMPTY,
  map,
  merge,
  mergeMap,
  scan,
  Subject,
  Subscription,
  tap,
  timer,
} from 'rxjs';
import { $t } from 'services/i18n';
import { mutation, PersistentStatefulService } from '../core';
import { downloadAndUnzip } from './downloadAndUnzip';
import { filterNoiseText } from './filterNoiseText';
import {
  CreateVoskCliClient,
  getVoskCliPath,
  isErrorTranscriptionMessage,
  isFormatTranscriptionMessage,
  isInfoTranscriptionMessage,
  isPartialTranscriptionMessage,
  isProcessExitedMessage,
  isTextTranscriptionMessage,
  ITranscriber,
} from './VoskClient';
import { VoskModelsManager } from './VoskModelsManager';

export const VOSK_MODEL_NAMES = ['vosk-model-small-ja-0.22', 'vosk-model-ja-0.22'];
const getVoskModelURL = (name: string): string => `https://alphacephei.com/vosk/models/${name}.zip`;

interface ITranscriptionServiceState {
  enabled?: boolean;
  voskModelName: string;
  audioDeviceId?: string | null;
  textFileEnabled?: boolean;
  textFilePath?: string;
  textFileMaxLine: number;
  textFileLineTimeToLive: number; // in milliseconds
}

export type VoskModelStatus = {
  state: 'not_downloaded' | 'downloading' | 'downloaded' | 'download_error';
  progress?: number; // percentage of download completion
};

export function voskModelStatusToString(status: VoskModelStatus): string {
  switch (status.state) {
    case 'downloading':
      return `${status.progress ?? 0}%`;
    default:
      return $t(`settings.transcription.modelStatus.${status.state}`);
  }
}

export class TranscriptionService extends PersistentStatefulService<ITranscriptionServiceState> {
  static defaultState: ITranscriptionServiceState = {
    voskModelName: VOSK_MODEL_NAMES[0],
    textFileMaxLine: 2,
    textFileLineTimeToLive: 5 * 1000, // 5 seconds
  };

  private voskCliPath: string;
  private modelBasePath: string;
  private modelsManager: VoskModelsManager;
  private client: ITranscriber;
  private state$ = new BehaviorSubject<ITranscriptionServiceState>(
    TranscriptionService.defaultState,
  );
  private textSubject$ = new Subject<string>();
  private partialSubject$ = new Subject<string>();
  private removeLineSubject$ = new Subject<void>();
  private linesSubject$ = new BehaviorSubject<{ texts: string[]; partial: string }>({
    texts: [],
    partial: '',
  });
  private modelsStatusSubject$ = new BehaviorSubject<Dictionary<VoskModelStatus>>({});
  private isActiveSubject$ = new BehaviorSubject<boolean>(false);

  getModelPath(modelName: string): string {
    return path.join(this.modelBasePath, modelName);
  }

  getVoskModels(): {
    name: string;
    description: string;
    status: VoskModelStatus;
  }[] {
    if (!this.modelsManager) {
      return [];
    }
    return this.modelsManager.getVoskModels();
  }

  text$ = this.textSubject$.asObservable();
  partial$ = this.partialSubject$.asObservable();
  lines$ = this.linesSubject$.asObservable();
  modelsStatus$ = this.modelsStatusSubject$.asObservable();
  get modelsStatus() {
    return this.modelsStatusSubject$.value;
  }
  isActive$ = this.isActiveSubject$.asObservable();
  get isActive(): boolean {
    return this.isActiveSubject$.value;
  }

  init() {
    super.init();

    this.voskCliPath = getVoskCliPath();

    this.modelBasePath = path.join(remote.app.getPath('userData'), 'vosk-model');
    this.modelsManager = new VoskModelsManager(this.modelBasePath);
    for (const model of VOSK_MODEL_NAMES) {
      this.setModelStatus(model, this.modelsManager.getVoskModelStatus(model));
    }

    this.state$.next(this.state);

    if (!this.state.textFilePath) {
      // default path for text file
      const tempDir = remote.app.getPath('temp');
      this.setTextFilePath(`${tempDir}/transcription.txt`);
    }

    // enable 状態を監視して、状態が変わったら activate する
    this.state$
      .pipe(
        map(
          state =>
            (state.enabled &&
              state.audioDeviceId &&
              this.modelsManager.getVoskModelStatus(state.voskModelName).state === 'downloaded') ??
            false,
        ),
        distinctUntilChanged(),
      )
      .subscribe(enabled => {
        console.log('TranscriptionService enabled state changed:', enabled); // DEBUG
        if (enabled) {
          this.activate();
        } else {
          this.deactivate();
        }
      });

    // audioDeviceId 状態を監視して、状態が変わったら setAudioDeviceId する
    this.state$
      .pipe(
        map(state => state.audioDeviceId ?? null),
        distinctUntilChanged(),
      )
      .subscribe(audioDeviceId => {
        if (this.client) {
          this.setAudioDeviceId(audioDeviceId);
        }
      });

    this.initTextFileWriter();
  }

  initTextFileWriter() {
    // 確定テキストが追加されるたびに、一定時間後に先頭行を削除するタイマーを開始する
    this.textSubject$
      .pipe(
        mergeMap(() => {
          const ttl = this.state.textFileLineTimeToLive;
          return ttl > 0 ? timer(ttl) : EMPTY;
        }),
      )
      .subscribe(() => this.removeLineSubject$.next());

    // linesSubject$ を更新するストリーム
    merge(
      this.partialSubject$.pipe(map(partial => ({ type: 'partial' as const, payload: partial }))),
      this.textSubject$.pipe(map(text => ({ type: 'text' as const, payload: text }))),
      this.removeLineSubject$.pipe(map(() => ({ type: 'remove_line' as const }))),
    )
      .pipe(
        scan((acc, action) => {
          if (action.type === 'partial') {
            if (action.payload === '') {
              return { ...acc, partial: '' }; // Clear partial if empty
            }
            return { ...acc, partial: `${action.payload}...` };
          } else if (action.type === 'text') {
            // action.type === 'text'
            const newTexts = [...acc.texts, action.payload];
            if (newTexts.length > this.state.textFileMaxLine) {
              newTexts.shift();
            }
            return { texts: newTexts, partial: '' };
          } else {
            // remove_line
            const newTexts = [...acc.texts];
            if (!newTexts.length) {
              return acc; // No lines to remove
            }
            newTexts.shift();
            return { ...acc, texts: newTexts };
          }
        }, this.linesSubject$.getValue()),
        tap(lines => {
          if (this.state.textFileEnabled && this.state.textFilePath) {
            const allLines = [...lines.texts];
            if (lines.partial) {
              allLines.push(lines.partial);
            }
            const content = allLines.slice(-this.state.textFileMaxLine).join('\n');
            fs.writeFile(this.state.textFilePath, content, 'utf-8').catch(err => {
              console.error('Failed to write transcription file:', err);
              this.setTextFileEnabled(false);
            });
          }
        }),
      )
      .subscribe(this.linesSubject$);
  }

  shutdown() {
    this.deactivate();
  }

  private subscription: Subscription;

  isReady(): boolean {
    return (
      this.state.enabled &&
      this.modelsManager.getVoskModelStatus(this.state.voskModelName).state === 'downloaded'
    );
  }

  activate() {
    if (this.client) {
      return;
    }
    console.log('Activating TranscriptionService...', this.state.voskModelName); // DEBUG
    if (this.modelsManager.getVoskModelStatus(this.state.voskModelName).state !== 'downloaded') {
      throw new Error(
        `Vosk model '${this.state.voskModelName}' is not downloaded. Please download it first.`,
      );
    }
    console.log('Vosk CLI client path:', this.voskCliPath); // DEBUG
    console.log('Model path:', this.getModelPath(this.state.voskModelName)); // DEBUG
    try {
      this.client = CreateVoskCliClient({
        voskCliPath: this.voskCliPath,
        modelPath: this.getModelPath(this.state.voskModelName),
      });
      console.log('Vosk CLI client created successfully'); // DEBUG
    } catch (err) {
      console.error('Failed to create Vosk CLI client:', err);
      this.client = null;
      return;
    }
    const audioDevices = this.client.audioDevices();
    this.setAudioDeviceId(audioDevices.devices.length > 0 ? audioDevices.devices[0].id : null);
    this.isActiveSubject$.next(true);
    this.subscription = this.client.startTranscription().subscribe({
      next: message => {
        console.log('Transcribe message:', message);
        if (isTextTranscriptionMessage(message)) {
          this.textSubject$.next(filterNoiseText(message.text));
        } else if (isPartialTranscriptionMessage(message)) {
          this.partialSubject$.next(filterNoiseText(message.partial));
        } else if (isErrorTranscriptionMessage(message)) {
          console.error('Transcription error:', message.error);
        } else if (isProcessExitedMessage(message)) {
          console.log('Vosk CLI process exited:', message.processExited);
          this.deactivate();
        } else if (isInfoTranscriptionMessage(message) || isFormatTranscriptionMessage(message)) {
          // can safely be ignored
        } else {
          console.warn('Unknown transcription message:', message);
        }
      },
      error: err => {
        console.error('Transcription error:', err);
      },
      complete: () => {
        console.log('Transcription completed');
        this.isActiveSubject$.next(false);
      },
    });
  }

  deactivate() {
    console.log('Deactivating TranscriptionService...'); // DEBUG
    if (this.client) {
      this.client.stopTranscription();
      this.client = null;
    }
    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = null;
    }
    this.isActiveSubject$.next(false);
  }

  setEnabled(enabled: boolean) {
    if (this.state.enabled === enabled) {
      return;
    }
    if (enabled) {
      console.log('Enabling TranscriptionService...'); // DEBUG
    } else {
      console.log('Disabling TranscriptionService...'); // DEBUG
    }
    this.setState({ enabled });
  }

  getAudioDeviceList(): { id: string; name: string }[] {
    if (!this.client) {
      return [];
    }
    return this.client.audioDevices().devices.map(device => ({
      id: device.id,
      name: device.name,
    }));
  }

  setAudioDeviceId(audioDeviceId: string | null) {
    const audioDevices = this.client.audioDevices();

    if (audioDeviceId) {
      const device = audioDevices.devices.find(d => d.id === audioDeviceId);
      if (!device) {
        console.warn(`Audio device with id ${audioDeviceId} not found.`);
        audioDeviceId = null;
      }
    }
    if (!audioDeviceId) {
      audioDeviceId = audioDevices.devices.length > 0 ? audioDevices.devices[0].id : null;
    }
    if (this.state.audioDeviceId === audioDeviceId) {
      return;
    }
    this.setState({ audioDeviceId });
    this.client.audioDeviceIndex = audioDeviceId
      ? this.client.audioDevices().devices.findIndex(d => d.id === audioDeviceId)
      : null;
  }

  setTextFileEnabled(textFileEnabled: boolean) {
    textFileEnabled = textFileEnabled ?? false;
    if (!!this.state.textFileEnabled === textFileEnabled) {
      return;
    }
    this.setState({ textFileEnabled });
  }
  setTextFilePath(textFilePath: string) {
    this.setState({ textFilePath });
  }
  setTextFileMaxLine(textFileMaxLine: number) {
    this.setState({ textFileMaxLine });
  }
  setTextFileLineTimeToLive(textFileLineTimeToLive: number) {
    if (textFileLineTimeToLive < 0) {
      textFileLineTimeToLive = 0;
    }
    this.setState({ textFileLineTimeToLive });
  }

  async startDownloadVoskModel(modelName: string) {
    const tmpDir = tmpdir();
    const tmpZipPath = path.join(tmpDir, `${modelName}.zip`);

    try {
      this.setModelStatus(modelName, { state: 'downloading' });

      const onProgress = ({ downloaded, total }: { downloaded: number; total: number }) => {
        if (total > 0) {
          const percentage = ((downloaded / total) * 100).toFixed(2);
          this.setModelStatus(modelName, {
            state: 'downloading',
            progress: parseFloat(percentage),
          });
          console.log(`Downloading ${modelName}... ${percentage}% of ${total} bytes`);
        } else {
          console.log(`Downloading ${modelName}... ${downloaded} bytes`);
        }
      };

      await downloadAndUnzip(
        getVoskModelURL(modelName),
        tmpZipPath,
        this.modelBasePath,
        onProgress,
      );

      this.setModelStatus(modelName, { state: 'downloaded' });
      if (this.isReady()) {
        this.activate();
      }
    } catch (err) {
      console.error('Error during Vosk model download/extraction:', err);
      this.setModelStatus(modelName, { state: 'download_error' });
      throw err;
    } finally {
      // Delete the temporary zip file
      if (existsSync(tmpZipPath)) {
        try {
          await fs.unlink(tmpZipPath);
          console.log('Temporary zip file deleted:', tmpZipPath);
        } catch (err) {
          console.error('Failed to delete temporary zip file:', err);
        }
      }
    }
  }

  /**
   * Deletes a Vosk model.
   * @param modelName The name of the model to delete.
   * @returns True if the model was deleted, false otherwise.
   */
  async deleteVoskModel(modelName: string): Promise<boolean> {
    const currentStatus = this.modelsManager.getVoskModelStatus(modelName);
    switch (currentStatus.state) {
      case 'downloading':
        throw new Error(`Vosk model ${modelName} is currently downloading.`);
      case 'not_downloaded':
      case 'download_error':
        return false;
    }

    this.setModelStatus(modelName, { state: 'not_downloaded' });
    if (this.state.voskModelName === modelName) {
      this.deactivate();
    }

    // modelPath のディレクトリを削除
    const modelPath = this.getModelPath(modelName);
    try {
      fs.rmdir(modelPath, { recursive: true });
      console.log('Deleted model directory:', modelPath);
    } catch (err) {
      console.error('Failed to delete model directory:', err);
    }
    return true;
  }

  private setModelStatus(modelName: string, status: VoskModelStatus) {
    this.modelsManager.setVoskModelStatus(modelName, status);
    this.modelsStatusSubject$.next({
      ...this.modelsStatusSubject$.getValue(),
      [modelName]: status,
    });
  }

  setModelName(modelName: string | null) {
    if (this.state.voskModelName === modelName) {
      return; // No change needed
    }
    this.deactivate(); // Restart transcription with the new model
    if (modelName === null) {
      modelName = this.modelsManager.getVoskModels()[0]?.name || null; // Default to the first model if none is set
    } else if (!this.modelsManager.getVoskModels().some(model => model.name === modelName)) {
      throw new Error(`Vosk model ${modelName} not found.`);
    }

    if (modelName !== null) {
      this.setState({ voskModelName: modelName });
      this.setModelStatus(modelName, this.modelsManager.getVoskModelStatus(modelName));
      if (this.isReady()) {
        this.activate();
      }
    } else {
      this.setState({ voskModelName: undefined });
    }
  }

  private setState(newState: Partial<ITranscriptionServiceState>) {
    newState = Object.assign({}, this.state, newState);
    this.SET_SETTINGS(newState);
    this.state$.next(this.state);
  }

  @mutation()
  private SET_SETTINGS(settingsPatch: Partial<ITranscriptionServiceState>) {
    this.state = Object.assign({}, this.state, settingsPatch);
  }
}
