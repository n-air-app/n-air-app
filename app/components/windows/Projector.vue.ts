import * as remote from '@electron/remote';
import Display from 'components/shared/Display.vue';
import ModalLayout from 'components/shared/ModalLayout.vue';
import electron from 'electron';
import { Subscription } from 'rxjs';
import { SourcesService } from 'services/sources';
import Util from 'services/utils';
import { WindowsService } from 'services/windows';
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'Projector',

  components: { ModalLayout, Display },

  data() {
    return {
      oldBounds: null as electron.Rectangle | null,
      sourcesSubscription: null as Subscription | null,
    };
  },

  computed: {
    windowId(): string {
      return Util.getCurrentUrlParams().windowId;
    },

    fullscreen(): boolean {
      return WindowsService.instance().state[this.windowId].isFullScreen;
    },

    sourceId(): string {
      return WindowsService.instance().getWindowOptions(this.windowId).sourceId as string;
    },

    allDisplays() {
      return remote.screen.getAllDisplays();
    },
  },

  mounted() {
    this.sourcesSubscription = SourcesService.instance().sourceRemoved.subscribe((source) => {
      if (source.sourceId === this.sourceId) {
        remote.getCurrentWindow().close();
      }
    });
  },

  unmounted() {
    this.sourcesSubscription?.unsubscribe();
  },

  methods: {
    enterFullscreen(display: electron.Display) {
      const currentWindow = remote.getCurrentWindow();
      WindowsService.instance().setOneOffFullscreen(this.windowId, true);
      this.oldBounds = currentWindow.getBounds();
      currentWindow.setPosition(display.bounds.x, display.bounds.y);
      currentWindow.setFullScreen(true);
      document.addEventListener('keydown', this.exitFullscreen);
    },

    exitFullscreen(e: KeyboardEvent) {
      if (e.code !== 'Escape') return;
      document.removeEventListener('keydown', this.exitFullscreen);
      WindowsService.instance().setOneOffFullscreen(this.windowId, false);
      const currentWindow = remote.getCurrentWindow();
      currentWindow.setFullScreen(false);
      currentWindow.setBounds(this.oldBounds);
    },
  },
});
