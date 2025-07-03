import { ObsListInput } from 'components/obs/inputs';
import ObsBoolInput from 'components/obs/inputs/ObsBoolInput.vue';
import { IObsInput, IObsListInput } from 'components/obs/inputs/ObsInput';
import { Inject } from 'services/core/injector';
import { $t } from 'services/i18n';
import { TranscriptionService } from 'services/transcription/transcription';
import Vue from 'vue';
import { Component } from 'vue-property-decorator';

@Component({
  components: {
    ObsBoolInput,
    ObsListInput,
  },
})
export default class TranscriptionSettings extends Vue {
  @Inject() transcriptionService: TranscriptionService;

  get enableTranscriptionModel(): IObsInput<boolean> {
    return {
      name: 'enableTranscription',
      description: $t('settings.transcription.enable'),
      value: this.transcriptionService.state.enabled ?? false,
      enabled: true,
    };
  }
  set enableTranscriptionModel(model: IObsInput<boolean>) {
    this.transcriptionService.setEnabled(model.value);
  }

  get transcriptionAudioSourceModel(): IObsListInput<string> {
    const sources = this.transcriptionService.getAudioDeviceList();
    return {
      description: $t('settings.transcription.audioSource'),
      name: 'transcriptionAudioSource',
      value: this.transcriptionService.state.audioDeviceId ?? '',
      options: [
        ...sources.map(source => ({
          description: source.name,
          value: source.id,
        })),
      ],
    };
  }
  set soundDetectorSourceModel(model: IObsListInput<string>) {
    this.transcriptionService.setAudioDeviceId(model.value);
  }
}
