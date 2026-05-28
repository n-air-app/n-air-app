import { TransitionsService } from 'services/transitions';
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'StudioModeControls',

  props: {
    stacked: { type: Boolean },
  },

  methods: {
    studioModeTransition() {
      TransitionsService.instance.executeStudioModeTransition();
    },
  },
});
