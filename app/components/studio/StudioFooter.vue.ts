import PerformanceMetrics from 'components/studio/PerformanceMetrics.vue';
import StreamingController from 'components/studio/StreamingController.vue';
import { CompactModeService } from 'services/compact-mode';
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'StudioFooter',

  components: {
    StreamingController,
    PerformanceMetrics,
  },

  props: {
    locked: { type: Boolean },
  },

  computed: {
    isCompactMode() {
      return CompactModeService.instance.isCompactMode;
    },
  },
});
