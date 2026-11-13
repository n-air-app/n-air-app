import Popper from 'components/shared/Popper.vue';
import Slider from 'components/shared/Slider.vue';
import MixerVolmeter from 'components/studio/MixerVolmeter.vue';
import { Subscription } from 'rxjs';
import { AudioSource, IVolmeter } from 'services/audio';
import { CompactModeService } from 'services/compact-mode';
import { CustomizationService } from 'services/customization';
import { $t } from 'services/i18n';
import { canGainUp, formatGainDb, LoudnessService, nextGainStep, SoundActivity } from 'services/loudness';
import { SourceFiltersService } from 'services/source-filters';
import { EditMenu } from 'util/menus/EditMenu';
import { GainMenu } from 'util/menus/GainMenu';
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
      // 配信音声が小さい状態か (ラウドネスパネルの計測から)
      quiet: false,
      // 最近音を出していたか。配信音声が小さい間だけ、ボリュームメーターから判定する
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
    this.subscription.add(LoudnessService.instance().quiet.subscribe((quiet) => this.setQuiet(quiet)));
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

    canGainUp(): boolean {
      return canGainUp({
        quiet: this.quiet,
        active: this.active,
        muted: this.audioSource.muted,
        faderDb: this.audioSource.fader.db,
        gainDb: this.gainDb,
      });
    },

    gainText(): string {
      return formatGainDb(this.gainDb);
    },

    gainTooltip(): string {
      const tooltip = $t('audio.gainBadgeTooltip', { db: this.gainText });
      // 上限なら、これ以上は OS の入力音量で上げることを案内する
      return nextGainStep(this.gainDb) === null ? `${tooltip} ${$t('audio.gainMaxTooltip')}` : tooltip;
    },

    // 「+」は上限未満のときだけ出すので、次の段階は必ずある
    nextGainText(): string {
      return formatGainDb(nextGainStep(this.gainDb) ?? this.gainDb);
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

    setQuiet(quiet: boolean) {
      this.quiet = quiet;
      if (!quiet) {
        this.volmeterSubscription?.unsubscribe();
        this.volmeterSubscription = null;
        this.active = false;
        return;
      }
      if (this.volmeterSubscription) return;
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

    showGainMenu() {
      new GainMenu(this.audioSource.sourceId).popup();
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
