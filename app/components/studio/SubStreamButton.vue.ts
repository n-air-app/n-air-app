import * as remote from '@electron/remote';
import { CompactModeService } from 'services/compact-mode';
import { $t } from 'services/i18n';
import { SubStreamService } from 'services/substream/SubStreamService';
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'SubStreamButton',
  props: {
    locked: { type: Boolean },
  },
  data() {
    return {
      subStreamStatus: '',
      subStreamUse: false,
      subStreamFetching: false,
      canStartSubStream: false,
      canStopSubStream: false,
      subStreamStarting: false,
      subStreamStopping: false,
      subStreamStreaming: false,
      statusTimer: undefined as number | undefined,
    };
  },
  computed: {
    isCompactMode() {
      return CompactModeService.instance().isCompactMode;
    },
    isStopButton(): boolean {
      return this.subStreamStopping || (!this.subStreamStarting && this.subStreamStreaming);
    },
    isDisabled(): boolean {
      return this.locked || this.subStreamStarting || this.subStreamStopping
        || !(this.isStopButton ? this.canStopSubStream : this.canStartSubStream);
    },
  },
  mounted() {
    this.subStreamFetching = true;
    this.reloadSubStreamStatus();
  },
  beforeUnmount() {
    this.subStreamFetching = false;
    if (this.statusTimer !== undefined) window.clearTimeout(this.statusTimer);
  },
  methods: {
    async updateSubStreamStatus() {
      this.subStreamUse = SubStreamService.instance().state.use;
      if (this.subStreamUse) {
        const status = await SubStreamService.instance().getStatus();
        this.subStreamStatus = status.displayStatus;
        this.canStartSubStream = !status.busy && !status.streaming
          && (status.status === 'stopped' || status.status === 'deactive');
        this.canStopSubStream = !status.busy && status.streaming;
        this.subStreamStreaming = status.streaming;
      } else {
        this.subStreamStatus = '';
        this.subStreamStreaming = false;
        this.canStartSubStream = false;
        this.canStopSubStream = false;
      }
    },

    async reloadSubStreamStatus() {
      try {
        await this.updateSubStreamStatus();
      } catch {
        this.canStartSubStream = false;
        this.canStopSubStream = false;
      } finally {
        if (this.subStreamFetching) {
          this.statusTimer = window.setTimeout(() => this.reloadSubStreamStatus(), 1000);
        }
      }
    },

    async startSubStream() {
      if (this.locked || !this.canStartSubStream || this.subStreamStarting || this.subStreamStopping) return;
      this.subStreamStarting = true;
      try {
        await this.updateSubStreamStatus();
        if (!this.canStartSubStream) return;
        const message = await SubStreamService.instance().start();
        if (message) {
          remote.dialog.showErrorBox($t('settings.substream.info.error'), message);
        }
        await this.updateSubStreamStatus();
      } catch {
        remote.dialog.showErrorBox(
          $t('settings.substream.info.error'),
          $t('settings.substream.error.connect_failed'),
        );
      } finally {
        this.subStreamStarting = false;
      }
    },

    async stopSubStream() {
      if (this.locked || !this.canStopSubStream || this.subStreamStarting || this.subStreamStopping) return;
      this.subStreamStopping = true;
      try {
        await this.updateSubStreamStatus();
        if (!this.canStopSubStream) return;
        await SubStreamService.instance().stop();
        await this.updateSubStreamStatus();
      } catch {
        remote.dialog.showErrorBox(
          $t('settings.substream.info.error'),
          $t('settings.substream.error.connect_failed'),
        );
      } finally {
        this.subStreamStopping = false;
      }
    },
  },
});
