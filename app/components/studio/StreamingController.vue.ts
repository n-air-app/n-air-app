import StartStreamingButton from 'components/studio/StartStreamingButton.vue';
import { $t } from 'services/i18n';
import { SettingsService } from 'services/settings';
import { EReplayBufferState, EStreamingState, StreamingService } from 'services/streaming';
import { UserService } from 'services/user';
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'StreamingController',

  components: {
    StartStreamingButton,
  },

  props: {
    locked: { type: Boolean },
  },

  data() {
    return {
      timeoutHandle: 0 as number,
      streamingElapsedTime: '--:--:--' as string,
      elapsedTimeTooltip: $t('streaming.elapsedTimeTooltip'),
      recordTooltip: $t('streaming.recordTooltip'),
      startReplayBufferTooltip: $t('streaming.startReplayBuffer'),
      stopReplayBufferTooltip: $t('streaming.stopReplayBuffer'),
      saveReplayTooltip: $t('streaming.saveReplay'),
    };
  },

  computed: {
    recording() {
      return StreamingService.instance.isRecording;
    },

    streamingStatus() {
      return StreamingService.instance.state.streamingStatus;
    },

    loggedIn() {
      return UserService.instance.isLoggedIn();
    },

    replayBufferEnabled() {
      return SettingsService.instance.state.Output?.RecRB;
    },

    replayBufferOffline() {
      return StreamingService.instance.state.replayBufferStatus === EReplayBufferState.Offline;
    },

    replayBufferStopping() {
      return StreamingService.instance.state.replayBufferStatus === EReplayBufferState.Stopping;
    },

    replayBufferSaving() {
      return StreamingService.instance.state.replayBufferStatus === EReplayBufferState.Saving;
    },
  },

  watch: {
    streamingStatus() {
      this.updateStreamingElapsedTime();
    },
  },

  mounted() {
    this.updateStreamingElapsedTime();
  },

  beforeUnmount() {
    this.clearTimeoutHandle();
  },

  methods: {
    toggleRecording() {
      StreamingService.instance.toggleRecording();
    },

    toggleReplayBuffer() {
      if (StreamingService.instance.state.replayBufferStatus === EReplayBufferState.Offline) {
        StreamingService.instance.startReplayBuffer();
      } else {
        StreamingService.instance.stopReplayBuffer();
      }
    },

    saveReplay() {
      StreamingService.instance.saveReplay();
    },

    clearTimeoutHandle() {
      if (this.timeoutHandle) {
        window.clearTimeout(this.timeoutHandle);
        this.timeoutHandle = 0;
      }
    },

    updateStreamingElapsedTime(): void {
      if (StreamingService.instance.state.streamingStatus !== EStreamingState.Live) {
        this.streamingElapsedTime = '--:--:--';
        this.clearTimeoutHandle();
        return;
      }

      this.streamingElapsedTime = StreamingService.instance.formattedDurationInCurrentStreamingState;

      this.clearTimeoutHandle();
      this.timeoutHandle = window.setTimeout(() => this.updateStreamingElapsedTime(), 200);
    },
  },
});
