import Popper from 'components/shared/Popper.vue';
import Slider from 'components/shared/Slider.vue';
import MixerVolmeter from 'components/studio/MixerVolmeter.vue';
import { AudioSource } from 'services/audio';
import { CompactModeService } from 'services/compact-mode';
import { CustomizationService } from 'services/customization';
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
    };
  },

  mounted() {
    const el = this.$el as HTMLElement;
    (this as any)._resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        this.narrowControls = entry.contentRect.width < NARROW_MIXER_THRESHOLD;
      }
    });
    (this as any)._resizeObserver.observe(el);
    this.narrowControls = el.offsetWidth < NARROW_MIXER_THRESHOLD;
  },

  beforeUnmount() {
    (this as any)._resizeObserver?.disconnect();
  },

  computed: {
    previewEnabled() {
      return !CustomizationService.instance().state.performanceMode;
    },

    isCompactMode(): boolean {
      return CompactModeService.instance().isCompactMode;
    },
  },

  methods: {
    setMuted(muted: boolean) {
      this.audioSource.setMuted(muted);
    },

    onSliderChangeHandler(newVal: number) {
      this.audioSource.setDeflection(newVal);
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
