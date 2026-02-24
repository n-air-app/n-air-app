import {
  BehaviorSubject,
  distinctUntilChanged,
  map,
  Observable,
  Subject,
  Subscription,
} from 'rxjs';
import { AudioService, AudioSource } from 'services/audio';
import { Inject, mutation, PersistentStatefulService } from 'services/core';

export const SpeechActionsOnSoundDetected = ['pause', 'cancel', 'graceful'] as const;
export type SpeechActionOnSoundDetected = (typeof SpeechActionsOnSoundDetected)[number];

export type SoundDetectedState = 'no-signal' | 'silence' | 'loud';

export interface ISoundDetectorState {
  enabled: boolean;
  sourceId: string | null | 'mic';
  soundThresholdDb: number;
  resumeSilenceMs: number;
  speechActionOnSoundDetected: SpeechActionOnSoundDetected;
  noSignalTimeoutMs: number;
  calibrated: boolean; // 音声しきい値が設定されているか
  declined: boolean; // ユーザーがダイアログで「いいえ」を選択したか
}

export class SoundDetectorService extends PersistentStatefulService<ISoundDetectorState> {
  @Inject() audioService: AudioService;

  static defaultState: ISoundDetectorState = {
    enabled: true,
    sourceId: 'mic',
    soundThresholdDb: -19,
    resumeSilenceMs: 500,
    speechActionOnSoundDetected: 'graceful',
    calibrated: false,
    declined: false,
    noSignalTimeoutMs: 1000,
  };

  private stateSubject: Subject<ISoundDetectorState> = new BehaviorSubject<ISoundDetectorState>(
    this.state,
  );
  stateUpdated: Observable<ISoundDetectorState> = this.stateSubject.asObservable();

  init(): void {
    super.init();

    // 不正値の補正
    if (!SpeechActionsOnSoundDetected.includes(this.state.speechActionOnSoundDetected)) {
      this.setState({
        speechActionOnSoundDetected: SoundDetectorService.defaultState.speechActionOnSoundDetected,
      });
    }

    this.stateSubject = new BehaviorSubject<ISoundDetectorState>(this.state);
    this.stateUpdated = this.stateSubject.asObservable();
  }

  private internalSubscriptions: Subscription = null;

  setEnabled(enabled: boolean): void {
    if (!enabled) {
      this.endSoundDetected();
    }
    this.setState({ enabled });
  }

  private enableCounter = 0;

  isEnabled(): boolean {
    return this.state.enabled && this.enableCounter > 0;
  }

  // 音声監視の有効化(ネスト対応)
  enable() {
    this.enableCounter++;
    if (this.enableCounter > 1) {
      return;
    }

    console.log('SoundDetectorService enabled'); // DEBUG

    this.internalSubscriptions = new Subscription();
    this.internalSubscriptions.add(
      this.stateUpdated.subscribe({
        next: state => {
          if (state.sourceId !== this.state.sourceId) {
            this.endSoundDetected();
            this.subscribeAudioSource(this.getEffectiveWatchSources(state.sourceId));
          }
          if (state.resumeSilenceMs !== this.state.resumeSilenceMs) {
            this.endSoundDetected();
          }
        },
      }),
    );

    this.internalSubscriptions.add(
      this.audioService.audioSourcesChanged.subscribe({
        next: () => {
          this.subscribeAudioSource();
        },
      }),
    );

    this.internalSubscriptions.add(
      this.audioService.muteChanged.subscribe({
        next: () => {
          // mute状態が変わったら、subscriptionを更新（mutedなソースを除外）
          this.subscribeAudioSource();
          this.updateSourceMuted();
        },
      }),
    );

    this.subscribeAudioSource();
  }

  // 音声監視の無効化(ネスト対応)
  disable() {
    this.enableCounter--;
    if (this.enableCounter > 0) {
      return;
    }
    console.log('SoundDetectorService disabled'); // DEBUG
    this.unsubscribeAudioSource();

    this.endSoundDetected();
    this.clearNoSignalTimer();

    this.internalSubscriptions.unsubscribe();
    this.internalSubscriptions = null;
  }

  private soundDetectedSubject = new BehaviorSubject<{ soundDetected: SoundDetectedState }>({
    soundDetected: 'no-signal',
  });
  soundDetectedObservable = this.soundDetectedSubject.asObservable();

  speechActionObservable: Observable<'pause' | 'cancel' | 'graceful' | 'resume'> =
    this.soundDetectedObservable.pipe(
      map(({ soundDetected }) => soundDetected === 'loud'),
      distinctUntilChanged(),
      map((soundDetected: boolean) => {
        if (soundDetected) {
          return this.state.speechActionOnSoundDetected;
        }
        return 'resume';
      }),
    );

  /**
   * 現在の音声再生を実際にブロックしているかどうか
   * 'graceful' の場合は loud でもブロックしない（現在の再生は最後まで続く）
   */
  isBlockingObservable: Observable<boolean> = this.soundDetectedObservable.pipe(
    map(({ soundDetected }) => {
      return (
        soundDetected === 'loud' && this.state.speechActionOnSoundDetected !== 'graceful'
      );
    }),
    distinctUntilChanged(),
  );

  private resumeTimer: ReturnType<typeof setTimeout> | null = null;
  private noSignalTimer: ReturnType<typeof setTimeout> | null = null;
  clearNoSignalTimer() {
    if (this.noSignalTimer !== null) {
      clearTimeout(this.noSignalTimer);
    }
  }
  startNoSignalTimer() {
    this.clearNoSignalTimer();
    this.noSignalTimer = setTimeout(() => {
      this.soundDetectedSubject.next({ soundDetected: 'no-signal' });
    }, this.state.noSignalTimeoutMs);
  }

  private isSoundDetected(): boolean {
    return this.resumeTimer !== null;
  }
  private endSoundDetected() {
    if (!this.isSoundDetected()) {
      return;
    }
    clearTimeout(this.resumeTimer);
    this.resumeTimer = null;
    this.soundDetectedSubject.next({ soundDetected: 'silence' });
  }

  private signalDetected() {
    if (this.isSoundDetected()) {
      return;
    }
    this.soundDetectedSubject.next({ soundDetected: 'silence' });
  }

  private startSoundDetected() {
    if (!this.state.enabled) {
      return;
    }
    if (this.isSoundDetected()) {
      // soundDetected中に呼ばれると再開タイマーを延長する
      clearTimeout(this.resumeTimer);
    } else {
      this.soundDetectedSubject.next({ soundDetected: 'loud' });
    }
    this.resumeTimer = setTimeout(() => this.endSoundDetected(), this.state.resumeSilenceMs);
  }

  audioSubscriptions = new Map<string, Subscription>();
  private audioSourcesSubject = new BehaviorSubject<AudioSource[]>([]);
  audioSources = this.audioSourcesSubject.asObservable();
  subscribeAudioSource(
    audioSources: AudioSource[] = this.getEffectiveWatchSources(this.state.sourceId),
  ) {
    this.audioSourcesSubject.next(audioSources);
    const newSourcesMap = new Map<string, Subscription>(
      audioSources.map(source => {
        const id = source.sourceId;
        return [
          id,
          this.audioSubscriptions.get(id) ??
            (() => {
              console.log(
                `subscribe audio source: ${id}, ${source.source.type}, muted:${source.muted}`,
              ); // DEBUG
              return source.getVolmeterStream().subscribe(volmeter => {
                if (volmeter.peak.some((p: number) => isFinite(p))) {
                  if (volmeter.peak.some((p: number) => p > this.state.soundThresholdDb)) {
                    this.startSoundDetected();
                  } else {
                    this.signalDetected();
                  }
                  this.startNoSignalTimer();
                }
              });
            })(),
        ];
      }),
    );
    // this.audioSubscriptionsにあってnewSourcesMapにない sourceId は削除
    this.audioSubscriptions.forEach((sub, id) => {
      if (!newSourcesMap.has(id)) {
        sub.unsubscribe();
        this.audioSubscriptions.delete(id);
      }
    });
    this.audioSubscriptions = newSourcesMap;
    this.updateSourceMuted();
  }
  unsubscribeAudioSource() {
    this.audioSubscriptions.forEach(sub => sub.unsubscribe());
    this.audioSubscriptions.clear();
    this.updateSourceMuted();
  }
  private sourceMutedSubject: Subject<boolean> = new BehaviorSubject<boolean>(false);
  sourceMuted: Observable<boolean> = this.sourceMutedSubject.asObservable();
  updateSourceMuted() {
    let muted = true;
    for (const sourceId of this.audioSubscriptions.keys()) {
      if (!this.audioService.getSource(sourceId).muted) {
        muted = false;
        break;
      }
    }
    this.sourceMutedSubject.next(muted);
  }

  getAvailableSources(): AudioSource[] {
    const sources = this.audioService.getVisibleSourcesForCurrentScene();
    return sources;
  }
  getEffectiveWatchSources(watchSourceId: ISoundDetectorState['sourceId']): AudioSource[] {
    const sources = this.getAvailableSources();
    if (watchSourceId === null) {
      return [];
    }
    let filtered: AudioSource[];
    if (watchSourceId === 'mic') {
      filtered = sources.filter(s =>
        ['wasapi_input_capture', 'nair-rtvc-source'].includes(s.source.type),
      );
    } else {
      filtered = sources.filter(s => s.sourceId === watchSourceId);
    }
    // mutedなソースは監視対象から除外
    return filtered.filter(s => !s.muted);
  }

  get isCalibrated(): boolean {
    return this.state.calibrated;
  }

  markCalibrated(): void {
    this.setState({ calibrated: true });
  }

  resetCalibrated(): void {
    this.setState({ calibrated: false });
  }

  get isDeclined(): boolean {
    return this.state.declined;
  }

  markDeclined(): void {
    this.setState({ declined: true });
  }

  updateSourceId(id: string | null): void {
    this.setState({ sourceId: id });
  }
  updateSoundThresholdDb(db: number): void {
    this.setState({ soundThresholdDb: db, calibrated: true });
  }
  updateResumeSilenceMs(ms: number): void {
    this.setState({ resumeSilenceMs: ms });
  }
  updateSpeechActionOnSoundDetected(action: SpeechActionOnSoundDetected): void {
    this.setState({ speechActionOnSoundDetected: action });
  }

  private setState(nextState: Partial<ISoundDetectorState>): void {
    const newState = { ...this.state, ...nextState };
    if (this.state.sourceId !== newState.sourceId) {
      newState.calibrated = false;
      newState.declined = false;
    }
    this.stateSubject.next(newState);
    this.SET_STATE(newState);
  }

  @mutation()
  private SET_STATE(nextState: ISoundDetectorState): void {
    this.state = nextState;
    console.log(`SoundDetectorService state updated: ${JSON.stringify(nextState)}`); // DEBUG
  }
}
