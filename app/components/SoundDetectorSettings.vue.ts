import { Subscription } from 'rxjs';
import { AudioService, AudioSource } from 'services/audio';
import { Inject } from 'services/core/injector';
import { NicoliveCommentSynthesizerService } from 'services/nicolive-program/nicolive-comment-synthesizer';
import {
  SoundDetectedState,
  SoundDetectorService,
  SpeechActionOnSoundDetected,
  SpeechActionsOnSoundDetected,
} from 'services/sound-detector';
import Vue from 'vue';
import { Component } from 'vue-property-decorator';
import { ObsListInput, ObsSliderInput } from './obs/inputs';
import { IObsInput, IObsListInput, IObsSliderInputValue } from './obs/inputs/ObsInput';
import SoundDetectorVolmeter from './SoundDetectorVolmeter.vue';

@Component({
  components: {
    SoundDetectorVolmeter,
    ObsSliderInput,
    ObsListInput,
  },
})
export default class SoundDetectorSettings extends Vue {
  @Inject() private soundDetectorService: SoundDetectorService;
  @Inject() private nicoliveCommentSynthesizerService: NicoliveCommentSynthesizerService;
  @Inject() private audioService: AudioService;

  get synthesizerEnabled(): boolean {
    return this.nicoliveCommentSynthesizerService.enabled;
  }
  get queueLength(): number {
    return this.nicoliveCommentSynthesizerService.queueLength;
  }

  private play(): void {
    const synthId = this.nicoliveCommentSynthesizerService.normal;
    this.nicoliveCommentSynthesizerService.testSpeechPlay(synthId, 'normal', false);
  }

  collapsed: boolean = true;
  speaking: boolean = false;
  speakingSubscription: Subscription;

  audioSourcesVersion: number = 0;
  audioSourcesChangedSubscription: Subscription;

  startMonitorSpeaking() {
    this.speakingSubscription = this.nicoliveCommentSynthesizerService.speaking.subscribe({
      next: speaking => {
        this.speaking = speaking;

        // 連続再生モード: 再生が終了したら次をキュー
        if (!speaking && this.isTestPlaybackActive && this.queueLength === 0) {
          this.play();
        }
      },
    });
  }
  endMonitorSpeaking() {
    this.speakingSubscription.unsubscribe();
  }

  isTestPlaybackActive: boolean = false;
  startContinuousPlayback() {
    if (this.isTestPlaybackActive) return; // 連続クリック防止

    this.isTestPlaybackActive = true;
    this.soundDetectorService.markCalibrated();
    this.play(); // 最初のテストメッセージを再生
  }

  stopContinuousPlayback() {
    if (!this.isTestPlaybackActive) return;

    this.isTestPlaybackActive = false;

    // 現在のキューをクリア
    this.nicoliveCommentSynthesizerService.queue.cancel();
  }

  sourceMuted = false;
  sourceMutedSubscription: Subscription;
  subscribeMuted() {
    this.sourceMutedSubscription = this.soundDetectorService.sourceMuted.subscribe({
      next: muted => {
        this.sourceMuted = muted;
      },
    });
  }
  unsubscribeMuted() {
    this.sourceMutedSubscription.unsubscribe();
  }

  subscribeAudioSourcesChanged() {
    const sub = new Subscription();
    sub.add(
      this.audioService.audioSourcesChanged.subscribe({
        next: () => {
          this.audioSourcesVersion++;
        },
      }),
    );
    sub.add(
      this.audioService.muteChanged.subscribe({
        next: () => {
          this.audioSourcesVersion++;
        },
      }),
    );
    this.audioSourcesChangedSubscription = sub;
  }

  unsubscribeAudioSourcesChanged() {
    this.audioSourcesChangedSubscription.unsubscribe();
  }

  mounted() {
    this.startMonitorSpeaking();
    this.startSoundDetection();
    this.subscribeMuted();
    this.subscribeAudioSourcesChanged();
  }

  beforeDestroy() {
    this.stopContinuousPlayback();
    this.unsubscribeMuted();
    this.unsubscribeAudioSourcesChanged();
    this.endSoundDetection();
    this.endMonitorSpeaking();
  }

  soundDetected: SoundDetectedState = 'no-signal';
  private soundDetectSubscription: Subscription;
  startSoundDetection() {
    this.nicoliveCommentSynthesizerService.enableSoundDetector(true);
    this.soundDetectSubscription = this.soundDetectorService.soundDetectedObservable.subscribe({
      next: detected => {
        this.soundDetected = detected.soundDetected;
      },
    });
  }
  endSoundDetection() {
    this.soundDetectSubscription.unsubscribe();
    this.nicoliveCommentSynthesizerService.enableSoundDetector(false);
  }

  get soundDetectorEnabled(): boolean {
    return this.soundDetectorService.state.enabled;
  }
  set soundDetectorEnabled(b: boolean) {
    this.soundDetectorService.setEnabled(b);
  }

  get soundDetectorSourceModel(): IObsListInput<string> {
    const sources = this.soundDetectorService.getAvailableSources();
    return {
      description: '入力音声ソース',
      name: 'audioWatchSource',
      value: this.soundDetectorService.state.sourceId,
      enabled: this.soundDetectorEnabled,
      options: [
        {
          description: 'マイクまたはボイスチェンジャー(自動)',
          value: 'mic',
        },
        ...sources.map(source => ({
          description: source.name,
          value: source.sourceId,
        })),
      ],
    };
  }
  set soundDetectorSourceModel(model: IObsListInput<string>) {
    this.soundDetectorService.updateSourceId(model.value);
  }
  get soundThresholdDbModel(): IObsSliderInputValue {
    return {
      description: '一時停止する最低音量音(dB)',
      name: 'soundThresholdDb',
      value: this.soundDetectorService.state.soundThresholdDb,
      minVal: -60,
      maxVal: 0,
      stepVal: 1,
      tooltip: 'hover',
      enabled: this.soundDetectorEnabled,
    };
  }
  set soundThresholdDbModel(model: IObsInput<number>) {
    this.soundDetectorService.updateSoundThresholdDb(model.value);
  }
  get resumeSilenceMsModel(): IObsSliderInputValue {
    return {
      description: '読み上げ再開までの時間(ms)',
      name: 'resumeSilenceMs',
      value: this.soundDetectorService.state.resumeSilenceMs,
      minVal: 0,
      maxVal: 10000,
      stepVal: 100,
      tooltip: 'hover',
      enabled: this.soundDetectorEnabled,
    };
  }
  set resumeSilenceMsModel(model: IObsInput<number>) {
    this.soundDetectorService.updateResumeSilenceMs(model.value);
  }
  // 音声検出時の読み上げ中音声に対する処理の選択肢。 pause or cancel
  get soundDetectedSpeechActionModel(): IObsListInput<string> {
    const options: { description: string; value: SpeechActionOnSoundDetected }[] = [
      {
        description: '一時停止',
        value: 'pause',
      },
      {
        description: '中断',
        value: 'cancel',
      },
      {
        description: '読み上げ中の音声は最後まで再生 (デフォルト)',
        value: 'graceful',
      },
    ];

    return {
      description: '一時停止する際の挙動',
      name: 'soundDetectedSpeechAction',
      value: this.soundDetectorService.state.speechActionOnSoundDetected,
      enabled: this.soundDetectorEnabled,
      options,
    };
  }
  set soundDetectedSpeechActionModel(model: IObsListInput<string>) {
    this.soundDetectorService.updateSpeechActionOnSoundDetected(
      model.value as (typeof SpeechActionsOnSoundDetected)[number],
    );
  }

  get isCalibrated(): boolean {
    return this.soundDetectorService.isCalibrated;
  }

  get soundDetectorAudioSources(): AudioSource[] {
    // audioSourcesVersionにアクセスすることで、これが変更されたときにgetterが再評価される
    this.audioSourcesVersion;
    return this.soundDetectorService
      .getEffectiveWatchSources(this.soundDetectorService.state.sourceId)
      .filter(source => !source.muted);
  }
}
