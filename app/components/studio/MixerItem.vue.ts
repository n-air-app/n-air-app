import Popper from 'components/shared/Popper.vue';
import Slider from 'components/shared/Slider.vue';
import MixerVolmeter from 'components/studio/MixerVolmeter.vue';
import { Subscription } from 'rxjs';
import { AudioSource, IVolmeter } from 'services/audio';
import { CompactModeService } from 'services/compact-mode';
import { CustomizationService } from 'services/customization';
import { formatGainDb, LoudnessService, nextGainStep, prevGainStep, SoundActivity } from 'services/loudness';
import { SourceFiltersService } from 'services/source-filters';
import { EditMenu } from 'util/menus/EditMenu';
import { defineComponent, PropType } from 'vue';

// コントロールをまとめるかどうかの幅の閾値
const NARROW_MIXER_THRESHOLD = 200;

export default defineComponent({
  name: 'MixerItem',

  components: { Slider, MixerVolmeter, Popper },

  props: {
    audioSource: { type: Object as PropType<AudioSource>, required: true as const },
  },

  data() {
    return {
      narrowControls: false,
      resizeObserver: null as ResizeObserver | null,
      // ゲイン (ゲインフィルタ) は OBS 側にあり reactive でないので、変更通知で読み直す
      gainDb: 0,
      // 配信音声が目標から外れている (小さい・大きい) か。ゲインの黄色表示に使う
      offTarget: false,
      // 最近音を出していたか (ボリュームメーターから判定)
      active: false,
      subscription: null as Subscription | null,
      volmeterSubscription: null as Subscription | null,
    };
  },

  mounted() {
    const el = this.$el as HTMLElement;
    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        this.narrowControls = entry.contentRect.width < NARROW_MIXER_THRESHOLD;
      }
    });
    this.resizeObserver.observe(el);
    this.narrowControls = el.offsetWidth < NARROW_MIXER_THRESHOLD;

    this.updateGain();
    this.subscription = new Subscription();
    this.subscription.add(
      SourceFiltersService.instance().filtersChanged.subscribe((sourceId) => {
        if (sourceId === this.audioSource.sourceId) this.updateGain();
      }),
    );
    this.subscription.add(LoudnessService.instance().offTarget.subscribe((offTarget) => (this.offTarget = offTarget)));
    this.watchActivity();
  },

  beforeUnmount() {
    this.resizeObserver?.disconnect();
    this.subscription?.unsubscribe();
    this.volmeterSubscription?.unsubscribe();
  },

  computed: {
    previewEnabled() {
      return !CustomizationService.instance().state.performanceMode;
    },

    isCompactMode(): boolean {
      return CompactModeService.instance().isCompactMode;
    },

    // 音を出しているソース全部に出す。ゲインが 0 以外なら、無音でも戻せるよう出し続ける
    showGain(): boolean {
      return this.active || this.gainDb !== 0;
    },

    canGainUp(): boolean {
      return nextGainStep(this.gainDb) !== null;
    },

    canGainDown(): boolean {
      return prevGainStep(this.gainDb) !== null;
    },

    gainText(): string {
      return formatGainDb(this.gainDb);
    },

    gainUpTooltip(): string {
      const next = nextGainStep(this.gainDb);
      // 上限なら、これ以上は OS の入力音量で上げることを案内する
      return next === null
        ? this.$t('audio.gainMaxTooltip')
        : this.$t('audio.gainUpTooltip', { db: formatGainDb(next) });
    },

    gainDownTooltip(): string {
      const prev = prevGainStep(this.gainDb);
      return prev === null
        ? this.$t('audio.gainMinTooltip')
        : this.$t('audio.gainDownTooltip', { db: formatGainDb(prev) });
    },
  },

  methods: {
    setMuted(muted: boolean) {
      this.audioSource.setMuted(muted);
    },

    onSliderChangeHandler(newVal: number) {
      this.audioSource.setDeflection(newVal);
    },

    updateGain() {
      this.gainDb = LoudnessService.instance().getGain(this.audioSource.sourceId);
    },

    watchActivity() {
      const activity = new SoundActivity();
      this.volmeterSubscription = this.audioSource.getVolmeterStream().subscribe((volmeter: IVolmeter) => {
        // フェーダー前のピークで見る (フェーダーを下げていても、音を出しているかは分かる)
        const active = activity.update(volmeter.inputPeak, Date.now());
        if (active !== this.active) this.active = active;
      });
    },

    gainUp() {
      LoudnessService.instance().gainUp(this.audioSource.sourceId);
    },

    gainDown() {
      LoudnessService.instance().gainDown(this.audioSource.sourceId);
    },

    showSourceMenu(sourceId: string) {
      const menu = new EditMenu({
        selectedSourceId: sourceId,
        showAudioMixerMenu: true,
      });
      menu.popup();
    },
  },
});
