import { BehaviorSubject, distinctUntilChanged, map, Subject, Subscription } from 'rxjs';
import { mutation, PersistentStatefulService } from '../core';
import { CreateSttClient, isTextTranscriptionMessage, ITranscriber } from './SttClient';

interface ITranscriptionServiceState {
  enabled?: boolean;
  audioDeviceId?: string | null;
}

export class TranscriptionService extends PersistentStatefulService<ITranscriptionServiceState> {
  static defaultState: ITranscriptionServiceState = {};

  private sttClitPath: string;
  private modelPath: string;
  private client: ITranscriber;
  private state$ = new BehaviorSubject<ITranscriptionServiceState>({});
  private textSubject$ = new Subject<string>();

  text$ = this.textSubject$.asObservable();

  init() {
    super.init();

    // 仮 TODO fix
    this.sttClitPath = '../stt_cli/out/stt_cli.exe';
    this.modelPath = '../stt_cli/model/vosk-model-small-ja-0.22';

    this.state$.next(this.state);

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

  private setState(statePatch: Partial<ITranscriptionServiceState>) {
    statePatch = Object.assign({}, this.state, statePatch);
    this.SET_SETTINGS(statePatch);
    this.state$.next(this.state);
  }

  @mutation()
  private SET_SETTINGS(settingsPatch: Partial<ITranscriptionServiceState>) {
    this.state = Object.assign({}, this.state, settingsPatch);
  }
}
