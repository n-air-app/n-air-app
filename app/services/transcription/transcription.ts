import * as remote from '@electron/remote';
import * as Sentry from '@sentry/vue';
import { existsSync, promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  BehaviorSubject,
  concatMap,
  distinctUntilChanged,
  EMPTY,
  filter,
  map,
  merge,
  mergeMap,
  scan,
  Subject,
  Subscription,
  tap,
  timer,
} from 'rxjs';
import { AudioService } from 'services/audio';
import { $t } from 'services/i18n';
import { sendLogGif } from 'services/nicolive-program/nicolive-logger';
import { NicoliveProgramService } from 'services/nicolive-program/nicolive-program';
import { TranscriptionLog } from 'services/usage-statistics';
import { Inject, mutation, PersistentStatefulService } from '../core';
import { CommentColor, CommentFont, CommentPosition, CommentSize } from './CommentModifier';
import { downloadAndUnzip, DownloadError, ExtractError } from './downloadAndUnzip';
import { filterNoiseText } from './filterNoiseText';
import { TranscriptionSourceUsageService } from './transcription-source-usage';
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
  VoskClient,
} from './VoskClient';
import { VOSK_MODEL_NAMES, VoskModelsManager, VoskModelStatus } from './VoskModelsManager';
export { VOSK_MODEL_NAMES, VoskModelStatus };

// original site: https://alphacephei.com/vosk/models -> `https://alphacephei.com/vosk/models/${name}.zip`;
const getVoskModelURL = (name: string): string =>
  `https://n-air-app.nicovideo.jp/download/assets/vosk-models/${name}.zip`;

export interface ITranscriptionServiceState {
  enabled?: boolean;
  voskModelName: string;
  audioDeviceId?: string | null;
  commentEnabled: boolean;
  commentPosition: CommentPosition;
  commentSize: CommentSize;
  commentFont: CommentFont;
  commentColor: CommentColor;
  commentPostDelay: number; // in milliseconds
  commentVposOffset: number; // in milliseconds
  textFileEnabled?: boolean;
  textFilePath?: string;
  textFileMaxLine: number;
  textFileLineTimeToLive: number; // in milliseconds
}

export type TimestampedText = {
  text: string;
  timestamp: number;
};

export function voskModelStatusToString(status: VoskModelStatus): string {
  switch (status.state) {
    case 'downloading':
      return `${status.progress ?? 0}%`;
    case 'download_error':
      return `${$t('settings.transcription.modelStatus.download_error')}: ${
        status.error_message ?? ''
      }`;
    default:
      return $t(`settings.transcription.modelStatus.${status.state}`);
  }
}

export function defaultTextFilePath() {
  const tempDir = remote.app.getPath('temp');
  return join(tempDir, 'transcription.txt');
}

export type ActiveStatus =
  | 'active'
  | 'disabled'
  | 'voskLaunchError'
  | 'voskError'
  | 'noAudioDevice'
  | 'noModelDownloaded'
  | 'noVoskModel'
  | 'modelLoadError'
  | 'muted';

export type VoskError = 'launchError' | 'error';

export class TranscriptionService extends PersistentStatefulService<ITranscriptionServiceState> {
  @Inject() transcriptionSourceUsageService: TranscriptionSourceUsageService;
  @Inject() audioService: AudioService;
  @Inject() nicoliveProgramService: NicoliveProgramService;

  static defaultState: ITranscriptionServiceState = {
    voskModelName: VOSK_MODEL_NAMES[0],
    commentEnabled: false,
    commentPosition: 'shita',
    commentFont: 'gothic',
    commentSize: 'medium',
    commentColor: 'white',
    commentPostDelay: 0,
    commentVposOffset: 0,
    textFileEnabled: true,
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
  private rawTextSubject$ = new Subject<string>();
  private textSubject$ = new Subject<TimestampedText>();
  private partialSubject$ = new Subject<string>();
  private removeLineSubject$ = new Subject<void>();
  private initializeTextSubject$ = new Subject<void>();
  private linesSubject$ = new BehaviorSubject<{ texts: string[]; partial: string }>({
    texts: [],
    partial: '',
  });
  private modelsStatusSubject$ = new BehaviorSubject<Dictionary<VoskModelStatus>>({});
  private activeStatusSubject$ = new BehaviorSubject<ActiveStatus>('disabled');
  private voskError$ = new BehaviorSubject<VoskError | null>(null);
  private updateActiveness$ = new Subject<void>();
  private audioDeviceMuted$ = new BehaviorSubject<boolean>(false);

  getModelPath(modelName: string): string {
    return join(this.modelBasePath, modelName);
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
  modelsStatus() {
    return this.modelsStatusSubject$.value;
  }
  activeStatus$ = this.activeStatusSubject$.asObservable();
  activeStatus(): ActiveStatus {
    return this.activeStatusSubject$.value;
  }

  isVoskModelReady(): boolean {
    const state = this.state;
    return (
      state.voskModelName &&
      this.modelsManager.getVoskModelStatus(state.voskModelName).state === 'downloaded'
    );
  }

  hasAnyDownloadedModel(): boolean {
    return this.getVoskModels().some(model => model.status.state === 'downloaded');
  }

  init() {
    super.init();

    this.voskCliPath = getVoskCliPath();

    this.modelBasePath = join(remote.app.getPath('userData'), 'vosk-model');
    this.modelsManager = new VoskModelsManager(this.modelBasePath);
    for (const model of VOSK_MODEL_NAMES) {
      this.setModelStatus(model, this.modelsManager.getVoskModelStatus(model));
    }

    this.state$.next(this.state);

    // partial または text が飛んできた時刻を記憶し、text が飛んできたタイミングで { text, timestamp } を textSubject$ に流す
    // partial が連続している場合は、最初の partial の時刻を記憶する
    // text が連続している場合は、それぞれ個別の text として扱う
    merge(
      this.rawTextSubject$.pipe(map(text => ({ type: 'text' as const, payload: text }))),
      this.partialSubject$.pipe(map(partial => ({ type: 'partial' as const, payload: partial }))),
    )
      .pipe(
        scan(
          (
            acc: { partialTimestamp: number | null; text: TimestampedText | null },
            action,
          ): { partialTimestamp: number | null; text: TimestampedText | null } => {
            const now = Date.now();
            if (action.type === 'text') {
              const timestamp = (acc.partialTimestamp ?? now) + this.state.commentVposOffset;
              return { ...acc, partialTimestamp: null, text: { text: action.payload, timestamp } };
            } else {
              // partial
              if (acc.partialTimestamp) {
                return { ...acc, text: null };
              } else {
                return { ...acc, partialTimestamp: now, text: null };
              }
            }
          },
          { partialTimestamp: null, text: null },
        ),
        filter(acc => acc.text !== null),
        map(acc => acc.text),
      )
      .subscribe(this.textSubject$);

    // テキストファイルのパスを固定する
    this.setTextFilePath(defaultTextFilePath());

    // enable 状態を監視して、状態が変わったら activate する
    merge(this.updateActiveness$, this.voskError$, this.audioDeviceMuted$)
      .pipe(
        map((): ActiveStatus => {
          if (!this.state.enabled) return 'disabled';

          const voskError = this.voskError$.value;
          if (voskError === 'launchError') return 'voskLaunchError';
          if (voskError === 'error') return 'voskError';

          if (this.audioDevices$.value.length === 0) return 'noAudioDevice';

          // 選択中のモデルの状態を先にチェック
          if (!this.state.voskModelName) return 'noVoskModel';

          const modelStatus = this.modelsManager.getVoskModelStatus(this.state.voskModelName);
          if (modelStatus.state === 'load_error') return 'modelLoadError';
          if (modelStatus.state !== 'downloaded') {
            // 選択中のモデルがダウンロードされていない場合のみ、他のモデルの存在をチェック
            if (!this.hasAnyDownloadedModel()) return 'noModelDownloaded';
            return 'noVoskModel';
          }

          if (this.audioDeviceMuted$.value) return 'muted';

          return 'active';
        }),
        tap(status => {
          console.log('TranscriptionService activeStatus:', status);
        }),
      )
      .subscribe(this.activeStatusSubject$);

    this.activeStatusSubject$
      .pipe(
        map(status => {
          const actual = !!this.client;
          const next = status === 'active';
          return actual !== next ? next : null;
        }),
        filter(next => next !== null),
      )
      .subscribe(enabled => {
        Sentry.addBreadcrumb({
          category: 'transcription',
          message: `TranscriptionService ${
            enabled ? 'activating' : 'deactivating'
          } due to activeStatus change`,
        });
        if (enabled) {
          this.activate();
        } else {
          this.deactivate();
        }
      });

    // audioDeviceId 状態を監視して、状態が変わったら audioDeviceIndex を更新する
    this.state$
      .pipe(
        map(state => state.audioDeviceId ?? null),
        distinctUntilChanged(),
      )
      .subscribe(audioDeviceId => {
        if (this.client) {
          this.client.audioDeviceIndex = this.getAudioDeviceIndex(audioDeviceId, 0);
        }
      });

    this.initTextFileWriter();

    this.createAudioDeviceMutedStream();

    this.updateAudioDevices();
  }

  private createAudioDeviceMutedStream() {
    merge(
      this.state$.pipe(
        map(state => state.audioDeviceId ?? null),
        distinctUntilChanged(),
      ),
      this.audioService.audioSourceUpdated,
    )
      .pipe(
        map(() => {
          const audioDeviceId = this.state.audioDeviceId;
          if (!audioDeviceId) {
            return false;
          }

          const isDefault = this.isDefaultAudioDevice(audioDeviceId);
          const audioSource = this.audioService.getSourceByDeviceId(audioDeviceId, isDefault);
          return audioSource ? audioSource.muted : false;
        }),
        distinctUntilChanged(),
      )
      .subscribe(this.audioDeviceMuted$);
  }

  getActionLog(): TranscriptionLog {
    const state = this.state;
    return {
      enabled: true,
      voskModelName: state.voskModelName,
      commentEnabled: state.commentEnabled,
      commentColor: state.commentColor,
      commentSize: state.commentSize,
      commentPosition: state.commentPosition,
      commentFont: state.commentFont,
      commentPostDelay: state.commentPostDelay,
      commentVposOffset: state.commentVposOffset,
      textFileMaxLine: state.textFileMaxLine,
      textFileLineTimeToLive: state.textFileLineTimeToLive,
      transcriptionSourceUsed:
        this.transcriptionSourceUsageService?.state.existsInActiveScene || false,
    };
  }

  initializeText() {
    this.initializeTextSubject$.next();
  }

  startStreaming() {
    this.transcriptionSourceUsageService?.startStreaming();
  }

  stopStreaming() {
    this.transcriptionSourceUsageService?.stopStreaming();
  }

  /**
   * テキスト行削除用のタイマーを開始し、subscriptions配列に追加する
   */
  private startRemoveLineTimer() {
    const ttl = this.state.textFileLineTimeToLive;
    if (ttl > 0) {
      const sub = timer(ttl).subscribe(() => {
        this.removeLineSubject$.next();
        // 完了したsubscriptionを配列から削除
        const index = this.timerSubscriptions.indexOf(sub);
        if (index !== -1) {
          this.timerSubscriptions.splice(index, 1);
        }
      });
      this.timerSubscriptions.push(sub);
    }
  }

  /**
   * 最も古いタイマーをキャンセルする（行数上限で押し出される場合に使用）
   */
  private cancelOldestTimer() {
    const oldestTimer = this.timerSubscriptions.shift();
    if (oldestTimer && !oldestTimer.closed) {
      oldestTimer.unsubscribe();
    }
  }

  /**
   * すべてのタイマーをクリーンアップする
   */
  private clearAllTimers() {
    this.timerSubscriptions.forEach(sub => {
      if (!sub.closed) {
        sub.unsubscribe();
      }
    });
    this.timerSubscriptions = [];
  }

  initTextFileWriter() {
    // 確定テキストが追加されるたびに、一定時間後に先頭行を削除するタイマーを開始する
    this.textSubject$.subscribe(() => {
      this.startRemoveLineTimer();
    });

    // linesSubject$ を更新するストリーム
    merge(
      this.partialSubject$.pipe(map(partial => ({ type: 'partial' as const, payload: partial }))),
      this.textSubject$.pipe(map(text => ({ type: 'text' as const, payload: text.text }))),
      this.removeLineSubject$.pipe(map(() => ({ type: 'remove_line' as const }))),
      this.initializeTextSubject$.pipe(map(() => ({ type: 'initialize' as const }))),
    )
      .pipe(
        scan((acc, action) => {
          switch (action.type) {
            case 'partial':
              if (action.payload === '') {
                return { ...acc, partial: '' }; // Clear partial if empty
              }
              return { ...acc, partial: `${action.payload}...` };
            case 'text': {
              const newTexts = [...acc.texts, action.payload];
              if (newTexts.length > this.state.textFileMaxLine) {
                newTexts.shift();
                // 行数上限で押し出される行に対応するタイマーをキャンセル
                this.cancelOldestTimer();
              }
              return { texts: newTexts, partial: '' };
            }
            case 'remove_line': {
              const newTexts = [...acc.texts];
              if (!newTexts.length) {
                return acc; // No lines to remove
              }
              newTexts.shift();
              return { ...acc, texts: newTexts };
            }
            case 'initialize': {
              return { texts: [$t('settings.transcription.placeholder')], partial: '' };
            }
          }
        }, this.linesSubject$.getValue()),
        tap(lines => {
          if (this.state.textFileEnabled && this.getTextFilePath()) {
            const allLines = [...lines.texts];
            if (lines.partial) {
              allLines.push(lines.partial);
            }
            const content = allLines.slice(-this.state.textFileMaxLine).join('\n');
            fs.writeFile(this.getTextFilePath(), content, 'utf-8').catch(err => {
              console.error('Failed to write transcription file:', err);
              this.setTextFileEnabled(false);
            });
          }
        }),
      )
      .subscribe(this.linesSubject$);

    // ストリームが閉じたとき（非アクティブになったとき）にテキストファイルを空にする
    this.activeStatus$
      .pipe(
        filter(isActive => !isActive), // 非アクティブになったときのみ
      )
      .subscribe(async () => {
        if (this.getTextFilePath()) {
          try {
            const stats = await fs.stat(this.getTextFilePath());
            if (stats.size > 0) {
              await fs.writeFile(this.getTextFilePath(), '', 'utf-8');
            }
          } catch (err) {
            if (err instanceof Error && 'code' in err && err.code !== 'ENOENT') {
              console.error('Failed to clear transcription file:', err);
            }
          }
        }
        // linesSubject$ もクリアする
        this.linesSubject$.next({ texts: [], partial: '' });
      });
  }

  shutdown() {
    this.deactivate();
  }

  private subscription: Subscription;
  private timerSubscriptions: Subscription[] = [];

  activate() {
    if (this.client) {
      return;
    }
    if (this.modelsManager.getVoskModelStatus(this.state.voskModelName).state !== 'downloaded') {
      throw new Error(
        `Vosk model '${this.state.voskModelName}' is not downloaded. Please download it first.`,
      );
    }
    console.log('Activating TranscriptionService with model:', this.state.voskModelName);
    try {
      this.client = CreateVoskCliClient({
        voskCliPath: this.voskCliPath,
        modelPath: this.getModelPath(this.state.voskModelName),
      });
      this.client.audioDeviceIndex = this.getAudioDeviceIndex(this.state.audioDeviceId, 0);
    } catch (err) {
      Sentry.withScope(scope => {
        scope.setTags({
          service: 'transcription',
          voskModelName: this.state.voskModelName,
        });
        scope.setExtra('voskCliPath', this.voskCliPath);
        scope.setExtra('modelPath', this.getModelPath(this.state.voskModelName));
        Sentry.captureException(err);
      });
      console.error('Failed to create Vosk CLI client:', err);
      this.client = null;
      this.voskError$.next('launchError');
      return;
    }

    this.subscription = this.client.startTranscription().subscribe({
      next: message => {
        console.log('Transcribe message:', message);
        if (isTextTranscriptionMessage(message)) {
          const text = filterNoiseText(message.text);
          if (text) {
            this.rawTextSubject$.next(text);
          }
        } else if (isPartialTranscriptionMessage(message)) {
          const partial = filterNoiseText(message.partial);
          if (partial) {
            this.partialSubject$.next(partial);
          }
        } else if (isErrorTranscriptionMessage(message)) {
          console.error('Transcription error:', message.error);
          if (message.error.startsWith('Failed to load model:')) {
            this.deactivate();
            this.setModelStatus(this.state.voskModelName, {
              state: 'load_error',
              error_message: message.error,
            });
          }
        } else if (isProcessExitedMessage(message)) {
          console.log('Vosk CLI process exited:', message.processExited);
          if (message.processExited.toLowerCase().includes('launch error')) {
            this.deactivate();
            this.voskError$.next('launchError');
          } else {
            this.deactivate();
            this.voskError$.next('error');
          }
        } else if (isInfoTranscriptionMessage(message) || isFormatTranscriptionMessage(message)) {
          // can safely be ignored
        } else {
          console.warn('Unknown transcription message:', message);
        }
      },
      error: err => {
        Sentry.withScope(scope => {
          scope.setTags({
            service: 'transcription',
            voskModelName: this.state.voskModelName,
          });
          Sentry.captureException(err);
        });
        console.error('Transcription error:', err);
      },
      complete: () => {
        console.log('Transcription completed');
      },
    });
  }

  deactivate() {
    if (this.client) {
      this.client.stopTranscription();
      this.client = null;
    }
    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = null;
    }
    // タイマーのクリーンアップ
    this.clearAllTimers();
  }

  setEnabled(enabled: boolean) {
    if (this.state.enabled === enabled) {
      return;
    }
    Sentry.addBreadcrumb({
      category: 'transcription',
      message: `TranscriptionService ${enabled ? 'enabled' : 'disabled'}`,
    });
    if (enabled) {
      this.voskError$.next(null);
      this.updateAudioDevices();
    }
    this.setState({ enabled });
  }

  private audioDevices$ = new BehaviorSubject<{ id: string; name: string }[]>([]);

  updateAudioDevices() {
    try {
      const audioDevices = VoskClient.listAudioDevices(this.voskCliPath);
      console.log('Vosk-cli: Available audio devices:', audioDevices.devices); // DEBUG
      this.audioDevices$.next(
        audioDevices.devices.map(device => ({
          id: device.id,
          name: device.name,
        })),
      );
      this.updateActiveness$.next();
    } catch (err) {
      console.error('Failed to create Vosk CLI client:', err);
      this.client = null;
      return;
    }
    if (this.client) {
      // デバイスリストを更新したので、audioDeviceIndex も更新する(見つかるようになったかもしれない)
      this.client.audioDeviceIndex = this.getAudioDeviceIndex(this.state.audioDeviceId, 0);
    }
    // audioDeviceId が未設定なら存在する値で更新する
    if (!this.state.audioDeviceId && this.audioDevices$.value.length > 0) {
      this.setAudioDeviceId(this.audioDevices$.value[0]?.id || null);
    }
  }

  getAudioDeviceIndex<T>(id: string, notFoundValue: T): number | T {
    if (!id) {
      return notFoundValue;
    }
    const index = this.audioDevices$.value.findIndex(device => device.id === id);
    if (index === -1) {
      return notFoundValue;
    }
    return index;
  }

  getAudioDeviceList(): { id: string; name: string }[] {
    return this.audioDevices$.value;
  }

  private isDefaultAudioDevice(audioDeviceId: string): boolean {
    return this.audioDevices$.value[0]?.id === audioDeviceId;
  }

  setAudioDeviceId(audioDeviceId: string | null) {
    const index = this.getAudioDeviceIndex(audioDeviceId, 0);
    const actualDeviceId =
      this.audioDevices$.value.length > 0 ? this.audioDevices$.value[index].id : null;
    if (audioDeviceId !== actualDeviceId) {
      console.warn(
        `Audio device with id ${audioDeviceId} not found. Using ${actualDeviceId} instead.`,
      );
    }
    this.setState({ audioDeviceId: actualDeviceId });
  }

  setTextFileEnabled(textFileEnabled: boolean) {
    textFileEnabled = textFileEnabled ?? false;
    if (!!this.state.textFileEnabled === textFileEnabled) {
      return;
    }
    this.setState({ textFileEnabled });
  }
  getTextFilePath(): string {
    return this.state.textFilePath;
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
    console.log('startDownloadVoskModel', modelName);
    Sentry.addBreadcrumb({
      category: 'transcription',
      message: `Start downloading Vosk model: ${modelName}`,
    });

    const tmpDir = tmpdir();
    const tmpZipPath = join(tmpDir, `${modelName}.zip`);

    try {
      this.setModelStatus(modelName, { state: 'downloading' });

      const onProgress = ({ downloaded, total }: { downloaded: number; total: number }) => {
        if (total > 0) {
          if (total === downloaded) {
            this.setModelStatus(modelName, { state: 'installing' });
            return;
          }
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

      const downloadUrl = getVoskModelURL(modelName);

      await downloadAndUnzip(downloadUrl, tmpZipPath, this.modelBasePath, onProgress);

      this.setModelStatus(modelName, { state: 'downloaded' });
      Sentry.captureEvent({
        message: 'Vosk model downloaded',
        level: 'info',
        tags: {
          service: 'transcription',
          model: modelName,
        },
      });
    } catch (err) {
      let error_message: string;
      let error_type: string;
      if (err instanceof DownloadError) {
        if (err.detail.reason === 'fetch') {
          error_message = $t('settings.transcription.download_error.network');
          error_type = 'network';
        } else {
          error_message = $t(
            `settings.transcription.download_error.http.${err.detail.response.status}`,
            {
              fallback: $t(`settings.transcription.download_error.http.x00`, {
                status: err.detail.response.status,
              }),
            },
          );
          error_type = `http.${err.detail.response.status}`;
        }
      } else if (err instanceof ExtractError) {
        error_message = $t('settings.transcription.download_error.extraction');
        error_type = 'extraction';
      } else {
        error_message = err instanceof Error ? err.message : String(err);
        error_type = 'error';
      }
      console.warn('Error during Vosk model download/extraction:', error_message);
      this.setModelStatus(modelName, {
        state: 'download_error',
        error_message,
      });
      Sentry.captureEvent({
        message: 'Vosk model download/extraction error',
        level: 'error',
        tags: {
          service: 'transcription',
          model: modelName,
          error_type,
        },
        extra: {
          error: err instanceof Error ? err.message : String(err),
        },
      });
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
    console.log('deleteVoskModel', modelName);
    Sentry.addBreadcrumb({
      category: 'transcription',
      message: `Delete Vosk model: ${modelName}`,
    });

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
    this.updateActiveness$.next();
  }

  setModelName(modelName: string | null) {
    Sentry.addBreadcrumb({
      category: 'transcription',
      message: `Set Vosk model: ${modelName}`,
    });

    if (this.state.voskModelName === modelName) {
      return; // No change needed
    }
    this.deactivate();
    if (modelName === null) {
      modelName = this.modelsManager.getVoskModels()[0]?.name || null; // Default to the first model if none is set
    } else if (!this.modelsManager.getVoskModels().some(model => model.name === modelName)) {
      throw new Error(`Vosk model ${modelName} not found.`);
    }

    if (modelName !== null) {
      this.setState({ voskModelName: modelName });
      this.setModelStatus(modelName, this.modelsManager.getVoskModelStatus(modelName));
    } else {
      this.setState({ voskModelName: undefined });
    }
  }

  setCommentEnabled(commentEnabled: boolean) {
    this.setState({ commentEnabled });
    const programID = this.nicoliveProgramService.state.programID;
    if (programID) {
      sendLogGif('transcription_setting', programID, { commentEnabled });
    }
  }

  setCommentPostDelay(commentPostDelay: number) {
    this.setState({ commentPostDelay });
  }

  setCommentVposOffset(commentVposOffset: number) {
    this.setState({ commentVposOffset });
  }

  setCommentPosition(commentPosition: CommentPosition) {
    this.setState({ commentPosition });
  }

  setCommentSize(commentSize: CommentSize) {
    this.setState({ commentSize });
  }

  setCommentFont(commentFont: CommentFont) {
    this.setState({ commentFont });
  }

  setCommentColor(commentColor: CommentColor) {
    this.setState({ commentColor });
  }

  private setState(newState: Partial<ITranscriptionServiceState>) {
    newState = Object.assign({}, this.state, newState);
    this.SET_SETTINGS(newState);
    this.state$.next(this.state);
    this.updateActiveness$.next();
  }

  @mutation()
  private SET_SETTINGS(settingsPatch: Partial<ITranscriptionServiceState>) {
    this.state = Object.assign({}, this.state, settingsPatch);
  }
}
