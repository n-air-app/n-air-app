import HelpTip from 'components/shared/HelpTip.vue';
import { CompactModeService } from 'services/compact-mode';
import { EDismissable } from 'services/dismissables';
import { $t } from 'services/i18n';
import { NicoliveProgramService } from 'services/nicolive-program/nicolive-program';
import { EStreamingState, StreamingService } from 'services/streaming';
import { defineComponent } from 'vue';

import StartStreamingIcon from '../../../media/images/start-streaming-icon.svg';

export default defineComponent({
  name: 'StartStreamingButton',

  components: {
    StartStreamingIcon,
    HelpTip,
  },

  props: {
    disabled: { type: Boolean },
  },

  data() {
    return {
      goLiveTooltip: $t('streaming.goLiveTooltip'),
      endStreamTooltip: $t('streaming.endStreamTooltip'),
    };
  },

  computed: {
    isCompactMode() {
      return CompactModeService.instance.isCompactMode;
    },

    streamingStatus() {
      return StreamingService.instance.state.streamingStatus;
    },

    programFetching() {
      return StreamingService.instance.state.programFetching;
    },

    isStreaming() {
      return StreamingService.instance.isStreaming;
    },

    isDisabled() {
      return (
        this.disabled
        || this.programFetching
        || (this.streamingStatus === EStreamingState.Starting
          && StreamingService.instance.delaySecondsRemaining === 0)
        || (this.streamingStatus === EStreamingState.Ending
          && StreamingService.instance.delaySecondsRemaining === 0)
      );
    },

    endStreamHelpTipDismissable() {
      return EDismissable.EndStreamHelpTip;
    },

    showEndStreamHelpTip(): boolean {
      if (this.streamingStatus === EStreamingState.Offline) {
        // ニコ生番組が放送中で、配信は停止している
        if (NicoliveProgramService.instance.state.status === 'onAir') {
          return true;
        }
      }
      return false;
    },
  },

  watch: {
    streamingStatus() {
      this.setDelayUpdate();
    },
  },

  methods: {
    toggleStreaming() {
      if (StreamingService.instance.isStreaming) {
        StreamingService.instance.toggleStreaming();
        return;
      }

      StreamingService.instance.toggleStreamingAsync();
    },

    getStreamButtonLabel() {
      if (this.programFetching) {
        return $t('streaming.programFetching');
      }

      if (this.streamingStatus === EStreamingState.Live) {
        return $t('streaming.endStream');
      }

      if (this.streamingStatus === EStreamingState.Starting) {
        if (StreamingService.instance.delayEnabled) {
          return $t('streaming.startingWithDelay', {
            delaySeconds: StreamingService.instance.delaySecondsRemaining,
          });
        }

        return $t('streaming.starting');
      }

      if (this.streamingStatus === EStreamingState.Ending) {
        if (StreamingService.instance.delayEnabled) {
          return $t('streaming.endingWithDelay', {
            delaySeconds: StreamingService.instance.delaySecondsRemaining,
          });
        }

        return $t('streaming.ending');
      }

      if (this.streamingStatus === EStreamingState.Reconnecting) {
        return $t('streaming.reconnecting');
      }

      return $t('streaming.goLive');
    },

    setDelayUpdate() {
      this.$forceUpdate();

      if (StreamingService.instance.delaySecondsRemaining) {
        setTimeout(() => this.setDelayUpdate(), 100);
      }
    },
  },
});
