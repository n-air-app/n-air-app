import { debounceTime, Subject, Subscription } from 'rxjs';
import { InitAfter, Inject } from 'services/core';
import { mutation, StatefulService } from 'services/core/stateful-service';
import { NVoiceCharacterService } from 'services/nvoice-character';
import { SoundDetectorService } from 'services/sound-detector';
import { UserService } from 'services/user';
import { QueueRunner, QueueRunnerState } from 'util/QueueRunner';

import { AddComponent } from './ChatMessage/ChatComponentType';
import { getDisplayText } from './ChatMessage/displaytext';
import { NVoiceClientService } from './n-voice-client';
import { NicoliveProgramService } from './nicolive-program';
import { ParaphraseDictionary } from './ParaphraseDictionary';
import { PhonemeServer } from './PhonemeServer';
import { ISpeechSynthesizer } from './speech/ISpeechSynthesizer';
import { NVoiceSynthesizer } from './speech/NVoiceSynthesizer';
import { VoicevoxSynthesizer } from './speech/VoicevoxSynthesizer';
import { WebSpeechSynthesizer } from './speech/WebSpeechSynthesizer';
import { NicoliveProgramStateService, SynthesizerId, SynthesizerSelector } from './state';
import { WrappedChat, WrappedMessage } from './WrappedChat';

export interface VoicevoxParam {
  id: string;
  name: string;
}

export type Speech = {
  text: string;
  synthesizer: SynthesizerId;
  rate: number; // 速度
  webSpeech?: {
    pitch?: number; // 声の高さ
  };
  volume?: number;
  nVoice?: {
    maxTime: number;
  };
  voicevox?: VoicevoxParam;
};

export interface ICommentSynthesizerState {
  enabled: boolean;
  soundDetectorEnabled: boolean;
  queueRunnerState: QueueRunnerState;
  pitch: number; // SpeechSynthesisUtterance.pitch; 0.1(lowest) to 2(highest) (default: 1), only for web speech
  rate: number; // SpeechSynthesisUtterence.rate; 0.1(lowest) to 10(highest); default:1
  volume: number; // SpeechSynthesisUtterance.volume; 0.1(lowest) to 1(highest)
  maxTime: number; // nVoice max time in seconds
  selector: {
    normal: SynthesizerSelector;
    operator: SynthesizerSelector;
    system: SynthesizerSelector;
  };
  voicevox: { normal: VoicevoxParam; operator: VoicevoxParam; system: VoicevoxParam };
}

@InitAfter('NicoliveProgramStateService')
export class NicoliveCommentSynthesizerService extends StatefulService<ICommentSynthesizerState> {
  @Inject('NicoliveProgramStateService') stateService: NicoliveProgramStateService;
  @Inject() private nicoliveProgramService: NicoliveProgramService;
  @Inject() nVoiceClientService: NVoiceClientService;
  @Inject() nVoiceCharacterService: NVoiceCharacterService;
  @Inject() private userService: UserService;
  @Inject() soundDetectorService: SoundDetectorService;

  static initialState: ICommentSynthesizerState = {
    enabled: true,
    soundDetectorEnabled: false,
    queueRunnerState: null,
    pitch: 1,
    rate: 1,
    volume: 1,
    maxTime: 4,
    selector: {
      normal: 'nVoice',
      operator: 'nVoice',
      system: 'webSpeech',
    },
    voicevox: {
      normal: { id: '', name: '' },
      operator: { id: '', name: '' },
      system: { id: '', name: '' },
    },
  };

  // この数すでにキューに溜まっている場合は破棄してから追加する
  NUM_COMMENTS_TO_SKIP = 5 as const;

  // delegate synth
  webSpeech = new WebSpeechSynthesizer();
  nVoice: NVoiceSynthesizer;
  voicevox = new VoicevoxSynthesizer();

  getSynthesizer(id: SynthesizerId): ISpeechSynthesizer | null {
    switch (id) {
      case 'webSpeech':
        return this.webSpeech;
      case 'nVoice':
        return this.nVoice;
      case 'voicevox':
        return this.voicevox;
      default:
        return null;
    }
  }

  queue = new QueueRunner();
  get queueLength(): number {
    return this.state.queueRunnerState.length;
  }
  get queueState(): QueueRunnerState['state'] {
    return this.state.queueRunnerState.state;
  }
  get queueDisabled(): boolean {
    return this.state.queueRunnerState.disabled;
  }

  phonemeServer: PhonemeServer;
  private queueStateSubscription: Subscription;

  // キューが完全にアイドル状態（実行中・準備中・待機中すべてなし）になったときに emit する
  // 遷移の瞬間の一時的な偽アイドル状態を避けるため debounceTime(0) を使用している
  private queueBecameIdleSubject = new Subject<void>();
  queueBecameIdle = this.queueBecameIdleSubject.asObservable();

  init(): void {
    this.setState({
      ...NicoliveCommentSynthesizerService.initialState,
      ...(this.stateService.state.speechSynthesizerSettings
        ? this.stateService.state.speechSynthesizerSettings
        : {}),
      soundDetectorEnabled: false, // 起動時には毎回false
      queueRunnerState: null, // 起動時にはnull
    });

    // setState() は SET_STATE() も呼ぶため this.state が即時更新される。
    // stateService.updated は外部からの設定変更(例: 別プロセスからの同期)を反映するために subscribe する。
    this.stateService.updated.subscribe({
      next: (persistentState) => {
        const newState = {
          ...NicoliveCommentSynthesizerService.initialState,
          ...persistentState.speechSynthesizerSettings,
        };
        this.SET_STATE(newState);
        this.syncSoundDetectorSubscription();
      },
    });

    this.queueStateSubscription = this.queue.state$.subscribe((queueRunnerState) => {
      this.setState({ queueRunnerState });
    });

    this.queue.state$.pipe(debounceTime(0)).subscribe(() => {
      if (!this.queue.isRunning) {
        this.queueBecameIdleSubject.next();
      }
    });
    this.nVoice = new NVoiceSynthesizer(this.nVoiceClientService);

    this.phonemeServer = new PhonemeServer({
      onPortAssigned: (port) => {
        this.nVoiceCharacterService.updateSocketIoPort(port);
      },
    });
  }

  private soundDetectorSubscription: Subscription;

  private subscribeSoundDetector() {
    if (this.soundDetectorSubscription) {
      return;
    }
    this.soundDetectorSubscription = this.soundDetectorService.speechActionObservable.subscribe({
      next: (action) => {
        switch (action) {
          case 'pause':
            this.queue.disable({ interruptAction: 'pause' });
            break;
          case 'cancel':
            this.queue.disable({ interruptAction: 'cancel' });
            break;
          case 'graceful':
            this.queue.disable({ interruptAction: 'graceful' });
            break;

          case 'resume':
            this.queue.enable();
            break;

          default:
            console.warn(`Unknown sound detector action: ${action}`);
        }
      },
    });
  }

  private unsubscribeSoundDetector() {
    if (this.soundDetectorSubscription) {
      this.soundDetectorSubscription.unsubscribe();
      this.soundDetectorSubscription = null;
    }
    this.queue.enable();
  }

  syncSoundDetectorSubscription(): void {
    if (this.state.enabled && this.soundDetectorService.isEnabled()) {
      this.subscribeSoundDetector();
    } else {
      this.unsubscribeSoundDetector();
    }
  }

  // 音声検出の有効/無効化(ネスト対応)
  enableSoundDetector(enable: boolean) {
    if (enable) {
      this.soundDetectorService.enable();
    } else {
      this.soundDetectorService.disable();
    }
    this.setState({ soundDetectorEnabled: this.soundDetectorService.isEnabled() });
  }
  private dictionary = new ParaphraseDictionary();

  makeSpeechText(chat: WrappedMessage, engine: SynthesizerId): string {
    if (!chat.value) {
      return '';
    }
    const text = getDisplayText(AddComponent(chat));
    if (!text) {
      return '';
    }

    const converted = this.dictionary.process(text, engine);

    return converted;
  }

  private selectSpeechSynthesizer(chat: WrappedMessage): SynthesizerSelector {
    switch (chat.type) {
      case 'normal':
        // 放送者からの通常コメントは読み上げない
        if (chat.value.user_id === this.userService.platform.id) {
          return 'ignore';
        }
        return this.state.selector.normal;
      case 'operator':
        return this.state.selector.operator;
      default:
        return this.state.selector.system;
    }
  }

  makeSpeech(chat: WrappedMessage, synthId?: SynthesizerSelector): Speech | null {
    const synthesizer = synthId || this.selectSpeechSynthesizer(chat);
    if (synthesizer === 'ignore') {
      return null;
    }

    const r = this.makeSpeechText(chat, synthesizer);
    if (r === '') {
      return null;
    }
    const speech: Speech = {
      rate: this.state.rate,
      synthesizer,
      volume: this.state.volume,
      webSpeech: {
        pitch: this.state.pitch,
      },
      nVoice: {
        maxTime: this.state.maxTime,
      },
      text: r,
    };

    if (synthesizer === 'voicevox') {
      switch (chat.type) {
        case 'normal':
          speech.voicevox = this.state.voicevox.normal;
          break;
        case 'operator':
          speech.voicevox = this.state.voicevox.operator;
          break;
        default:
          speech.voicevox = this.state.voicevox.system;
          break;
      }
    }

    return speech;
  }

  makeSimpleTextSpeech(
    text: string,
    synthId: SynthesizerId,
    type: WrappedChat['type'],
  ): Speech | null {
    return this.makeSpeech(
      {
        type,
        value: {
          content: text,
        },
        seqId: 1,
      },
      synthId,
    );
  }

  private speakingSubject = new Subject<boolean>();
  speaking = this.speakingSubject.asObservable();

  startSpeakingSimple(speech: Speech, cancelBeforeSpeaking = true) {
    const onstart = () => {
      this.speakingSubject.next(true);
    };
    const onend = () => {
      this.speakingSubject.next(false);
    };
    this.queueToSpeech(speech, onstart, onend, cancelBeforeSpeaking);
  }

  startTestSpeech(
    text: string,
    synthId: SynthesizerId,
    type: WrappedChat['type'],
    cancelBeforeSpeaking = true,
  ) {
    const speech = this.makeSimpleTextSpeech(text, synthId, type);
    if (!speech) return;
    this.startSpeakingSimple(speech, cancelBeforeSpeaking);
  }

  /**
   * テスト音声を再生する（UIコンポーネントから使用）
   * @param synthId 音声合成エンジンID
   * @param type チャットタイプ ('normal', 'operator', 'system')
   * @param cancelBeforeSpeaking 再生前にキューをキャンセルするか
   */
  testSpeechPlay(
    synthId: SynthesizerSelector,
    type: WrappedChat['type'],
    cancelBeforeSpeaking = true,
  ): void {
    if (synthId === 'ignore') return;

    this.startTestSpeech(
      'これは読み上げ設定のテスト音声です',
      synthId,
      type,
      cancelBeforeSpeaking,
    );
  }

  queueToSpeech(
    speech: Speech,
    onstart: () => void,
    onend: () => void,
    cancelBeforeSpeaking = false,
    label?: string,
  ) {
    if (!this.enabled) {
      return;
    }

    const toPlay = speech.synthesizer;
    const toPlaySynth = this.getSynthesizer(toPlay);
    if (toPlaySynth === null) return;

    if (cancelBeforeSpeaking) {
      this.queue.cancel();
    } else if (this.queue.length >= this.NUM_COMMENTS_TO_SKIP) {
      // コメント溜まりすぎスキップ
      // TODO 飛ばした発言
      this.queue.cancelQueue();
    }

    this.queue.add(
      toPlaySynth.speakText(
        speech,
        () => {
          onstart();
        },
        () => {
          onend();
        },
        (phoneme) => {
          this.phonemeServer?.emitPhoneme(phoneme);
        },
      ),
      label ?? speech.text,
    );
    this.queue.runNext();
  }

  private isNVoiceConfigured(): boolean {
    const { selector } = this.state;
    return selector.normal === 'nVoice' || selector.operator === 'nVoice' || selector.system === 'nVoice';
  }

  prefetchNVoice(): void {
    if (!this.state.enabled || !this.isNVoiceConfigured()) {
      return;
    }
    this.nVoiceClientService.prefetch().catch(() => {
      // already logged inside prefetch()
    });
  }

  private setEnabled(enabled: boolean) {
    this.setState({ enabled });
    if (!enabled) {
      this.queue.cancel();
    } else if (this.nicoliveProgramService.state.viewUri) {
      this.prefetchNVoice();
    }
  }
  get enabled(): boolean {
    return this.state.enabled;
  }
  set enabled(e: boolean) {
    this.setEnabled(e);
  }

  private setPitch(pitch: number) {
    this.setState({ pitch });
  }
  get pitch(): number {
    return this.state.pitch;
  }
  set pitch(p: number) {
    this.setPitch(p);
  }

  private setRate(rate: number) {
    this.setState({ rate });
  }
  get rate(): number {
    return this.state.rate;
  }
  set rate(r: number) {
    this.setRate(r);
  }

  private setVolume(volume: number) {
    this.setState({ volume });
  }
  get volume(): number {
    return this.state.volume;
  }
  set volume(r: number) {
    this.setVolume(r);
  }

  private setMaxTime(maxTime: number) {
    this.setState({ maxTime });
  }
  get maxTime(): number {
    return this.state.maxTime || NicoliveCommentSynthesizerService.initialState.maxTime;
  }
  set maxTime(m: number) {
    this.setMaxTime(m);
  }

  // selector accessor
  get normal(): SynthesizerSelector {
    return this.state.selector.normal;
  }
  set normal(s: SynthesizerSelector) {
    this.setState({ selector: { ...this.state.selector, normal: s } });
  }
  get operator(): SynthesizerSelector {
    return this.state.selector.operator;
  }
  set operator(s: SynthesizerSelector) {
    this.setState({ selector: { ...this.state.selector, operator: s } });
  }
  get system(): SynthesizerSelector {
    return this.state.selector.system;
  }
  set system(s: SynthesizerSelector) {
    this.setState({ selector: { ...this.state.selector, system: s } });
  }

  get voicevoxNormal(): VoicevoxParam {
    return this.state.voicevox.normal;
  }
  set voicevoxNormal(param: Partial<VoicevoxParam>) {
    const normal = { ...this.state.voicevox.normal, ...param };
    this.setState({ voicevox: { ...this.state.voicevox, normal } });
  }
  get voicevoxOperator(): VoicevoxParam {
    return this.state.voicevox.operator;
  }
  set voicevoxOperator(param: Partial<VoicevoxParam>) {
    const operator = { ...this.state.voicevox.operator, ...param };
    this.setState({ voicevox: { ...this.state.voicevox, operator } });
  }
  get voicevoxSystem(): VoicevoxParam {
    return this.state.voicevox.system;
  }
  set voicevoxSystem(param: Partial<VoicevoxParam>) {
    const system = { ...this.state.voicevox.system, ...param };
    this.setState({ voicevox: { ...this.state.voicevox, system } });
  }

  private setState(partialState: Partial<ICommentSynthesizerState>) {
    const nextState = { ...this.state, ...partialState };
    this.SET_STATE(nextState);
    this.stateService.updateSpeechSynthesizerSettings(nextState);
  }

  @mutation()
  private SET_STATE(nextState: ICommentSynthesizerState): void {
    this.state = nextState;
  }
}
