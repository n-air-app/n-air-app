import Slider from 'components/shared/Slider.vue';
import { NicoliveCommentSynthesizerService } from 'services/nicolive-program/nicolive-comment-synthesizer';
import { SynthesizerId } from 'services/nicolive-program/state';
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'SpeechEngineSettings',
  components: { Slider },
  computed: {
    enabled: {
      get(): boolean {
        return NicoliveCommentSynthesizerService.instance().enabled;
      },
      set(e: boolean) {
        NicoliveCommentSynthesizerService.instance().enabled = e;
      },
    },
    maxTime: {
      get(): number {
        return NicoliveCommentSynthesizerService.instance().maxTime;
      },
      set(v: number) {
        NicoliveCommentSynthesizerService.instance().maxTime = v;
      },
    },
    maxTimeCandidates(): number[] {
      return [3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10];
    },
    maxTimeDefault(): number {
      return NicoliveCommentSynthesizerService.initialState.maxTime;
    },
    pitch: {
      get(): number {
        return NicoliveCommentSynthesizerService.instance().pitch;
      },
      set(v: number) {
        NicoliveCommentSynthesizerService.instance().pitch = v;
      },
    },
    pitchCandidates(): number[] {
      return [
        0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9,
        2,
      ];
    },
    pitchDefault(): number {
      return NicoliveCommentSynthesizerService.initialState.pitch;
    },
  },
  methods: {
    close() {
      this.$emit('close');
    },
    testSpeechPlay(synthId: SynthesizerId) {
      NicoliveCommentSynthesizerService.instance().startTestSpeech('これは読み上げ設定のテスト音声です', synthId, 'normal');
    },
    resetNVoice() {
      this.maxTime = this.maxTimeDefault;
    },
    resetWindows() {
      this.pitch = this.pitchDefault;
    },
  },
});

