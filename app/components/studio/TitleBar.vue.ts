import * as remote from '@electron/remote';
import { CompactModeService } from 'services/compact-mode';
import { isDevHosts } from 'services/dev-hosts';
import { $t } from 'services/i18n';
import { StreamingService } from 'services/streaming';
import Utils from 'services/utils';
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'TitleBar',

  props: {
    title: { type: String },
    resizable: { type: Boolean, default: true },
  },

  computed: {
    isMinimizable() {
      return remote.getCurrentWindow().isMinimizable();
    },

    isUnstable() {
      return Utils.isMainWindow() && Utils.isUnstable();
    },

    isDevHosts() {
      return Utils.isMainWindow() && isDevHosts();
    },

    isCompactMode() {
      return CompactModeService.instance().isCompactMode;
    },

    isStreaming() {
      return StreamingService.instance().isStreaming;
    },
  },

  methods: {
    minimize() {
      remote.getCurrentWindow().minimize();
    },

    maximize() {
      const win = remote.getCurrentWindow();

      if (win.isMaximized()) {
        win.unmaximize();
      } else {
        win.maximize();
      }
    },

    close() {
      if (Utils.isMainWindow() && StreamingService.instance().isStreaming) {
        if (!confirm($t('streaming.endStreamInStreamingConfirm'))) return;
      }

      remote.getCurrentWindow().close();
    },
  },
});
