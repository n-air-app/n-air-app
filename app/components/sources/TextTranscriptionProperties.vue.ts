import { SettingsService } from 'services/settings';
import { TranscriptionService } from 'services/transcription/transcription';
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'TextTranscriptionProperties',

  computed: {
    isTranscriptionEnabled(): boolean {
      // 設定画面とこの画面はテレコなのでon/offタイミングでこの画面は出ていないた め現状subscriptionまでは不要
      return TranscriptionService.instance.state.enabled ?? false;
    },
  },

  methods: {
    openSettings(): void {
      SettingsService.instance.showSettings('Transcription');
    },
  },
});
