import { ObsListInput, ObsSliderInput } from 'components/obs/inputs';
import { IObsInput, IObsListInput, IObsSliderInputValue } from 'components/obs/inputs/ObsInput';
import SoundDetectorVolmeter from 'components/settings/SoundDetectorVolmeter.vue';
import TocSection from 'components/shared/TocSection.vue';
import { Subscription } from 'rxjs';
import { AudioService, AudioSource } from 'services/audio';
import { NicoliveCommentSynthesizerService } from 'services/nicolive-program/nicolive-comment-synthesizer';
import {
  SoundDetectedState,
  SoundDetectorService,
  SpeechActionOnSoundDetected,
  SpeechActionsOnSoundDetected,
} from 'services/sound-detector';
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'SoundDetectorSettings',
  components: {
    SoundDetectorVolmeter,
    ObsSliderInput,
    ObsListInput,
    TocSection,
  },
  data() {
    return {
      collapsed: true,
      speaking: false,
      speakingSubscription: null as Subscription | null,
      audioSourcesVersion: 0,
      audioSourcesChangedSubscription: null as Subscription | null,
      isTestPlaybackActive: false,
      sourceMuted: false,
      sourceMutedSubscription: null as Subscription | null,
      sourceAvailable: true,
      sourceAvailableSubscription: null as Subscription | null,
      soundDetected: 'no-signal' as SoundDetectedState,
      soundDetectSubscription: null as Subscription | null,
    };
  },
  computed: {
    synthesizerEnabled(): boolean {
      return NicoliveCommentSynthesizerService.instance().enabled;
    },
    queueLength(): number {
      return NicoliveCommentSynthesizerService.instance().queueLength;
    },
    soundDetectorEnabled: {
      get(): boolean {
        return SoundDetectorService.instance().state.enabled;
      },
      set(b: boolean) {
        if (!b) {
          this.stopContinuousPlayback();
        }
        SoundDetectorService.instance().setEnabled(b);
        NicoliveCommentSynthesizerService.instance().syncSoundDetectorSubscription();
      },
    },
    soundDetectorSourceModel: {
      get(): IObsListInput<string> {
        // audioSourcesVersion にアクセスすることで再評価される
        this.audioSourcesVersion;
        const sources = SoundDetectorService.instance().getAvailableSources();
        const sourceId = SoundDetectorService.instance().state.sourceId;
        const options: { description: string; value: string }[] = [
          { description: 'マイクまたはボイスチェンジャー(自動)', value: 'mic' },
          ...sources.map((source) => ({
            description: source.name,
            value: source.sourceId,
          })),
        ];
        if (sourceId !== null && sourceId !== 'mic' && !options.some((o) => o.value === sourceId)) {
          options.push({ description: '(このシーンにありません)', value: sourceId });
        }
        return {
          description: '入力音声ソース',
          name: 'audioWatchSource',
          value: sourceId,
          enabled: this.soundDetectorEnabled,
          options,
        };
      },
      set(model: IObsListInput<string>) {
        SoundDetectorService.instance().updateSourceId(model.value);
      },
    },
    soundThresholdDbModel: {
      get(): IObsSliderInputValue {
        return {
          description: '一時停止する最低音量(dB)',
          name: 'soundThresholdDb',
          value: SoundDetectorService.instance().state.soundThresholdDb,
          minVal: -60,
          maxVal: 0,
          stepVal: 1,
          tooltip: 'hover',
          enabled: this.soundDetectorEnabled,
        };
      },
      set(model: IObsInput<number>) {
        SoundDetectorService.instance().updateSoundThresholdDb(model.value);
      },
    },
    resumeSilenceMsModel: {
      get(): IObsSliderInputValue {
        return {
          description: '読み上げ再開までの時間(ms)',
          name: 'resumeSilenceMs',
          value: SoundDetectorService.instance().state.resumeSilenceMs,
          minVal: 100,
          maxVal: 10000,
          stepVal: 100,
          tooltip: 'hover',
          enabled: this.soundDetectorEnabled,
        };
      },
      set(model: IObsInput<number>) {
        SoundDetectorService.instance().updateResumeSilenceMs(model.value);
      },
    },
    soundDetectedSpeechActionModel: {
      get(): IObsListInput<string> {
        const options: { description: string; value: SpeechActionOnSoundDetected }[] = [
          { description: '一時停止', value: 'pause' },
          { description: '中断', value: 'cancel' },
          { description: '読み上げ中の音声は最後まで再生 (デフォルト)', value: 'graceful' },
        ];
        return {
          description: '一時停止する際の挙動',
          name: 'soundDetectedSpeechAction',
          value: SoundDetectorService.instance().state.speechActionOnSoundDetected,
          enabled: this.soundDetectorEnabled,
          options,
        };
      },
      set(model: IObsListInput<string>) {
        SoundDetectorService.instance().updateSpeechActionOnSoundDetected(
          model.value as (typeof SpeechActionsOnSoundDetected)[number],
        );
      },
    },
    soundDetectorAudioSources(): AudioSource[] {
      // audioSourcesVersion にアクセスすることで再評価される
      this.audioSourcesVersion;
      return SoundDetectorService.instance()
        .getEffectiveWatchSources(SoundDetectorService.instance().state.sourceId)
        .filter((source) => !source.muted);
    },
  },
  mounted() {
    this.startMonitorSpeaking();
    this.startSoundDetection();
    this.subscribeMuted();
    this.subscribeSourceAvailable();
    this.subscribeAudioSourcesChanged();
  },
  beforeUnmount() {
    this.stopContinuousPlayback();
    this.unsubscribeMuted();
    this.unsubscribeSourceAvailable();
    this.unsubscribeAudioSourcesChanged();
    this.endSoundDetection();
    this.endMonitorSpeaking();
  },
  methods: {
    play(): void {
      const synthId = NicoliveCommentSynthesizerService.instance().normal;
      NicoliveCommentSynthesizerService.instance().testSpeechPlay(synthId, 'normal', false);
    },
    triggerNextTestPlaybackIfNeeded() {
      if (!this.speaking && this.isTestPlaybackActive && this.queueLength === 0) {
        this.play();
      }
    },
    startMonitorSpeaking() {
      this.speakingSubscription = new Subscription();
      this.speakingSubscription.add(
        NicoliveCommentSynthesizerService.instance().speaking.subscribe({
          next: (speaking) => {
            this.speaking = speaking;
            this.triggerNextTestPlaybackIfNeeded();
          },
        }),
      );
      this.speakingSubscription.add(
        NicoliveCommentSynthesizerService.instance().queueBecameIdle.subscribe({
          next: () => {
            this.triggerNextTestPlaybackIfNeeded();
          },
        }),
      );
    },
    endMonitorSpeaking() {
      this.speakingSubscription!.unsubscribe();
    },
    startContinuousPlayback() {
      if (this.isTestPlaybackActive) return;
      this.isTestPlaybackActive = true;
      this.play();
    },
    stopContinuousPlayback() {
      if (!this.isTestPlaybackActive) return;
      this.isTestPlaybackActive = false;
      NicoliveCommentSynthesizerService.instance().queue.cancel();
    },
    subscribeMuted() {
      this.sourceMutedSubscription = SoundDetectorService.instance().sourceMuted.subscribe({
        next: (muted) => {
          this.sourceMuted = muted;
        },
      });
    },
    unsubscribeMuted() {
      this.sourceMutedSubscription!.unsubscribe();
    },
    subscribeSourceAvailable() {
      this.sourceAvailableSubscription = SoundDetectorService.instance().sourceAvailable.subscribe({
        next: (available) => {
          this.sourceAvailable = available;
        },
      });
    },
    unsubscribeSourceAvailable() {
      this.sourceAvailableSubscription!.unsubscribe();
    },
    subscribeAudioSourcesChanged() {
      const sub = new Subscription();
      sub.add(
        AudioService.instance().audioSourcesChanged.subscribe({
          next: () => {
            this.audioSourcesVersion++;
          },
        }),
      );
      sub.add(
        AudioService.instance().muteChanged.subscribe({
          next: () => {
            this.audioSourcesVersion++;
          },
        }),
      );
      this.audioSourcesChangedSubscription = sub;
    },
    unsubscribeAudioSourcesChanged() {
      this.audioSourcesChangedSubscription!.unsubscribe();
    },
    startSoundDetection() {
      NicoliveCommentSynthesizerService.instance().enableSoundDetector(true);
      this.soundDetectSubscription = SoundDetectorService.instance().soundDetectedObservable.subscribe({
        next: (detected: { soundDetected: SoundDetectedState }) => {
          this.soundDetected = detected.soundDetected;
        },
      });
      this.soundDetected = SoundDetectorService.instance().getCurrentSoundDetected();
    },
    endSoundDetection() {
      this.soundDetectSubscription!.unsubscribe();
      NicoliveCommentSynthesizerService.instance().enableSoundDetector(false);
    },
  },
});
