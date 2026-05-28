import Display from 'components/shared/Display.vue';
import StudioControls from 'components/studio/StudioControls.vue';
import StudioEditor from 'components/studio/StudioEditor.vue';
import StudioModeControls from 'components/studio/StudioModeControls.vue';
import { CompactModeService } from 'services/compact-mode';
import { CustomizationService } from 'services/customization';
import { TransitionsService } from 'services/transitions';
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'Studio',

  components: {
    StudioEditor,
    StudioControls,
    Display,
    StudioModeControls,
  },

  data() {
    return {
      stacked: false,
      sizeCheckInterval: 0,
    };
  },

  mounted() {
    this.sizeCheckInterval = window.setInterval(() => {
      if (this.studioMode && this.$refs.studioModeContainer) {
        const rect = (this.$refs.studioModeContainer as HTMLDivElement).getBoundingClientRect();

        if (rect.width / rect.height > 16 / 9) {
          this.stacked = false;
        } else {
          this.stacked = true;
        }
      }
    }, 1000);
  },

  unmounted() {
    clearInterval(this.sizeCheckInterval);
  },

  computed: {
    previewEnabled(): boolean {
      return !CustomizationService.instance.state.performanceMode;
    },

    studioMode(): boolean {
      return TransitionsService.instance.state.studioMode;
    },

    isCompactMode(): boolean {
      return CompactModeService.instance.isCompactMode;
    },

    compactModeTab() {
      return CompactModeService.instance.compactModeTab;
    },
  },

  methods: {
    studioModeTransition() {
      TransitionsService.instance.executeStudioModeTransition();
    },

    enablePreview() {
      CustomizationService.instance.setSettings({ performanceMode: false });
    },
  },
});
