import { Inject } from 'services/core/injector';
import { SettingsService } from 'services/settings';
import { TranscriptionService } from 'services/transcription/transcription';
import Vue from 'vue';
import { Component } from 'vue-property-decorator';

@Component({})
export default class TextTranscriptionProperties extends Vue {
  @Inject() transcriptionService: TranscriptionService;
  @Inject() settingsService: SettingsService;

  get isTranscriptionEnabled(): boolean {
    // 設定画面とこの画面はテレコなのでon/offタイミングでこの画面は出ていないため現状subscriptionまでは不要
    return this.transcriptionService.state.enabled ?? false;
  }

  openSettings() {
    this.settingsService.showSettings('Transcription');
  }
}
