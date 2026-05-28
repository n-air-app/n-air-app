import { CompactModeService } from 'services/compact-mode';
import { DismissablesService, EDismissable } from 'services/dismissables';
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'HelpTip',

  props: {
    dismissableKey: { type: String as () => EDismissable },
    mode: { type: String, default: 'scene-selector' },
  },

  computed: {
    shouldShow(): boolean {
      return DismissablesService.instance.shouldShow(this.dismissableKey as EDismissable);
    },

    isCompactMode(): boolean {
      return CompactModeService.instance.isCompactMode;
    },
  },

  methods: {
    closeHelpTip() {
      DismissablesService.instance.dismiss(this.dismissableKey as EDismissable);
    },
  },
});
