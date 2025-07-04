import * as remote from '@electron/remote';
import { promises as fs } from 'fs';
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
import { mutation, PersistentStatefulService } from '../core';
import {
  CreateSttClient,
  isPartialTranscriptionMessage,
  isTextTranscriptionMessage,
  ITranscriber,
} from './SttClient';

interface ITranscriptionServiceState {
  enabled?: boolean;
  audioDeviceId?: string | null;
  textFileEnabled?: boolean;
  textFilePath?: string;
  textFileMaxLine: number;
  textFileLineTimeToLive: number; // in milliseconds
}

export class TranscriptionService extends PersistentStatefulService<ITranscriptionServiceState> {
  static defaultState: ITranscriptionServiceState = {
    textFileMaxLine: 2,
    textFileLineTimeToLive: 5 * 1000, // 5 seconds
  };

  private sttClitPath: string;
  private modelPath: string;
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

  text$ = this.textSubject$.asObservable();
  partial$ = this.partialSubject$.asObservable();
  lines$ = this.linesSubject$.asObservable();

  init() {
    super.init();

    // 仮 TODO fix
    this.sttClitPath = '../stt_cli/out/stt_cli.exe';
    this.modelPath = '../stt_cli/model/vosk-model-small-ja-0.22';

    this.state$.next(this.state);

    if (!this.state.textFilePath) {
      // default path for text file
      const tempDir = remote.app.getPath('temp');
      this.setTextFilePath(`${tempDir}/transcription.txt`);
    }

    // enable 状状を監視して、状態が変わったら activate する
    this.state$
      .pipe(
        map(state => state.enabled ?? false),
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

  activate() {
    if (this.client) {
      return;
    }
    console.log('Activating TranscriptionService...'); // DEBUG
    try {
      this.client = CreateSttClient({
        sttCliPath: this.sttClitPath,
        modelPath: this.modelPath,
      });
      console.log('STT client created successfully'); // DEBUG
    } catch (err) {
      console.error('Failed to create STT client:', err);
      this.client = null;
      return;
    }
    const audioDevices = this.client.audioDevices();
    this.setAudioDeviceId(audioDevices.devices.length > 0 ? audioDevices.devices[0].id : null);
    this.subscription = this.client.startTranscription().subscribe({
      next: message => {
        console.log('Transcribe message:', message);
        if (isTextTranscriptionMessage(message)) {
          this.textSubject$.next(message.text);
        } else if (isPartialTranscriptionMessage(message)) {
          this.partialSubject$.next(message.partial);
        }
      },
      error: err => {
        console.error('Transcription error:', err);
      },
      complete: () => {
        console.log('Transcription completed');
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
        throw new Error(`Audio device with id ${audioDeviceId} not found.`);
      }
    }
    if (!audioDeviceId) {
      audioDeviceId = audioDevices.devices.length > 0 ? audioDevices.devices[0].id : null;
    } else {
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
