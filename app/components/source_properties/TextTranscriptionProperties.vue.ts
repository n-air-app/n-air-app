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
    return this.transcriptionService.state.enabled ?? false;
  }

  openSettings() {
    this.settingsService.showSettings('Transcription');
  }
}
