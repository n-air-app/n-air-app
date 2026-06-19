import { AppService } from 'services/app';
import { WindowsService } from 'services/windows';
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'ModalLayout',

  props: {
    // Whether the "cancel" and "done" controls should be
    // shown at the bottom of the modal.
    showControls: { type: Boolean, default: true },
    // If controls are shown, whether or not to show the cancel button.
    showCancel: { type: Boolean, default: true },
    // Will be called when "done" is clicked if controls are enabled
    doneHandler: { type: Function },
    // Will be called when "cancel" is clicked.
    // By default this will just close the window.
    cancelHandler: { type: Function },
    // The height of the fixed section
    fixedSectionHeight: { type: Number },
    /**
     * Set to true when using custom controls.
     * Custom controls go in the "controls" slot.
     */
    customControls: { type: Boolean, default: false },
    /** Contentにpaddingを持たせない場合 */
    bareContent: { type: Boolean, default: false },
    /* Contentをスクロールさせない場合 */
    noScroll: { type: Boolean, default: false },
  },

  data() {
    return {
      contentStyle: {} as Record<string, string>,
      fixedStyle: {
        height: ((this.fixedSectionHeight as number) || 0).toString() + 'px',
      } as Record<string, string>,
    };
  },

  computed: {
    loading(): boolean {
      return AppService.instance().state.loading;
    },
  },

  methods: {
    cancel() {
      if (this.cancelHandler) {
        (this.cancelHandler as Function)();
      } else {
        WindowsService.instance().closeChildWindow();
      }
    },

    done() {
      if (this.doneHandler) {
        (this.doneHandler as Function)();
      } else {
        WindowsService.instance().closeChildWindow();
      }
    },
  },
});
