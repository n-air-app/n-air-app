import { EStreamingState, StreamingService } from 'services/streaming';
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'StreamingStatus',

  computed: {
    streamingStatus() {
      return StreamingService.instance().state.streamingStatus;
    },

    isStreaming() {
      return StreamingService.instance().isStreaming;
    },

    liveText() {
      if (this.streamingStatus === EStreamingState.Live) return 'LIVE';
      if (this.streamingStatus === EStreamingState.Starting) return 'STARTING';
      if (this.streamingStatus === EStreamingState.Ending) return 'ENDING';
      if (this.streamingStatus === EStreamingState.Reconnecting) return 'RECONNECTING';
      return 'OFFLINE';
    },
  },
});
