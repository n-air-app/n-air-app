import { IObsListInput } from 'components/obs/inputs/ObsInput';
import ObsListInput from 'components/obs/inputs/ObsListInput.vue';
import ModalLayout from 'components/shared/ModalLayout.vue';
import { AudioService } from 'services/audio';
import { $t } from 'services/i18n';
import { LoudnessService } from 'services/loudness';
import { MEASURE_DURATION_MS } from 'services/loudness/loudness-adjust';
import { WindowsService } from 'services/windows';
import { defineComponent } from 'vue';

// 初期選択にするソースの種別 (マイク)
const MIC_SOURCE_TYPES = ['wasapi_input_capture', 'nair-rtvc-source'];

type Step = 'select' | 'measuring' | 'done' | 'silent';

interface ICandidate {
  sourceId: string;
  name: string;
  isMic: boolean;
}

export default defineComponent({
  name: 'LoudnessAdjust',

  components: { ModalLayout, ObsListInput },

  data() {
    const candidates: ICandidate[] = AudioService.instance()
      .getVisibleSourcesForCurrentScene()
      .filter((source) => !source.muted)
      .map((source) => ({
        sourceId: source.sourceId,
        name: source.name,
        isMic: MIC_SOURCE_TYPES.includes(source.source?.type ?? ''),
      }));
    const initial = candidates.find((source) => source.isMic) ?? candidates[0];

    return {
      step: 'select' as Step,
      candidates,
      selectedId: initial?.sourceId ?? '',
      resultMessage: '',
      limited: false,
      elapsedMs: 0,
      progressTimer: null as ReturnType<typeof setInterval> | null,
    };
  },

  computed: {
    sourceInput(): IObsListInput<string> {
      return {
        name: 'loudness_adjust_source',
        description: '',
        showDescription: false,
        value: this.selectedId,
        options: this.candidates.map((source: ICandidate) => ({
          description: source.name,
          value: source.sourceId,
        })),
      };
    },

    progressPercent(): number {
      return Math.min(100, Math.round((this.elapsedMs / MEASURE_DURATION_MS) * 100));
    },

    remainingSeconds(): number {
      return Math.max(0, Math.ceil((MEASURE_DURATION_MS - this.elapsedMs) / 1000));
    },
  },

  beforeUnmount() {
    this.stopProgress();
  },

  methods: {
    onSourceInput(input: IObsListInput<string>) {
      this.selectedId = input.value ?? '';
    },

    async start() {
      const sourceId = this.selectedId;
      if (!sourceId) return;

      this.step = 'measuring';
      this.startProgress();
      const loudnessService = LoudnessService.instance();
      const measured = await loudnessService.measureSource(sourceId, MEASURE_DURATION_MS);
      this.stopProgress();
      if (measured === null) {
        this.step = 'silent';
        return;
      }

      const plan = loudnessService.applyAdjustment(sourceId, measured);
      this.limited = plan.limited;
      this.resultMessage = this.describe(plan.faderDb, plan.gainDb);
      this.step = 'done';
    },

    startProgress() {
      this.elapsedMs = 0;
      const startedAt = Date.now();
      this.progressTimer = setInterval(() => {
        this.elapsedMs = Date.now() - startedAt;
      }, 100);
    },

    stopProgress() {
      if (this.progressTimer !== null) {
        clearInterval(this.progressTimer);
        this.progressTimer = null;
      }
    },

    describe(faderDb: number, gainDb: number | null): string {
      if (gainDb !== null && gainDb !== 0) {
        const key = gainDb > 0 ? 'resultGain' : 'resultGainDown';
        const message = $t(`audio.loudnessAdjust.${key}`, { gain: gainDb.toFixed(1) });
        // ゲインで下げ切れず、フェーダーも下げた場合は両方を伝える
        return faderDb < 0
          ? `${message}\n${$t('audio.loudnessAdjust.resultFader', { fader: faderDb.toFixed(1) })}`
          : message;
      }
      if (faderDb < 0) {
        return $t('audio.loudnessAdjust.resultFader', { fader: faderDb.toFixed(1) });
      }
      return $t('audio.loudnessAdjust.resultNone');
    },

    close() {
      WindowsService.instance().closeChildWindow();
    },
  },
});
