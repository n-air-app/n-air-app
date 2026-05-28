import Slider from 'components/shared/Slider.vue';
import MixerVolmeter from 'components/studio/MixerVolmeter.vue';
import { AudioSource } from 'services/audio';
import { CompactModeService } from 'services/compact-mode';
import { CustomizationService } from 'services/customization';
import { EditMenu } from 'util/menus/EditMenu';
import { defineComponent, PropType } from 'vue';

export default defineComponent({
  name: 'MixerItem',

  components: { Slider, MixerVolmeter },

  props: {
    audioSource: { type: Object as PropType<AudioSource> },
  },

  computed: {
    previewEnabled() {
      return !CustomizationService.instance.state.performanceMode;
    },

    isCompactMode(): boolean {
      return CompactModeService.instance.isCompactMode;
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
