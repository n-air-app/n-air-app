import { ObsBoolInput, ObsListInput, ObsNumberInput, ObsPathInput } from 'components/obs/inputs';
import {
  IObsInput,
  IObsListInput,
  IObsNumberInputValue,
  IObsPathInputValue,
} from 'components/obs/inputs/ObsInput';
import { Inject } from 'services/core/injector';
import { $t } from 'services/i18n';
import { TranscriptionService } from 'services/transcription/transcription';
import Vue from 'vue';
import { Component } from 'vue-property-decorator';

@Component({
  components: {
    ObsBoolInput,
    ObsListInput,
    ObsPathInput,
    ObsNumberInput,
  },
})
export default class TranscriptionSettings extends Vue {
  @Inject() transcriptionService: TranscriptionService;

  get enabledModel(): IObsInput<boolean> {
    return {
      name: 'enableTranscription',
      description: $t('settings.transcription.enable'),
      value: this.transcriptionService.state.enabled ?? false,
      enabled: true,
    };
  }
  set enabledModel(model: IObsInput<boolean>) {
    this.transcriptionService.setEnabled(model.value);
  }

  get audioSourceIdModel(): IObsListInput<string> {
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
  set audioSourceIdModel(model: IObsListInput<string>) {
    this.transcriptionService.setAudioDeviceId(model.value);
  }

  get textFileEnabledModel(): IObsInput<boolean> {
    return {
      name: 'enableTranscriptionTextFile',
      description: $t('settings.transcription.enableTextFile'),
      value: this.transcriptionService.state.textFileEnabled ?? false,
      enabled: true,
    };
  }
  set textFileEnabledModel(model: IObsInput<boolean>) {
    this.transcriptionService.setTextFileEnabled(model.value);
  }
  get textFilePathModel(): IObsPathInputValue {
    return {
      name: 'transcriptionTextFilePath',
      description: $t('settings.transcription.textFilePath'),
      value: this.transcriptionService.state.textFilePath ?? '',
      enabled: true,
      filters: [{ name: 'Text Files', extensions: ['txt'] }],
    };
  }
  set textFilePathModel(model: IObsPathInputValue) {
    this.transcriptionService.setTextFilePath(model.value);
  }

  get textFileMaxLineModel(): IObsNumberInputValue {
    return {
      name: 'transcriptionTextFileMaxLine',
      description: $t('settings.transcription.textFileMaxLine'),
      value: this.transcriptionService.state.textFileMaxLine,
      enabled: true,
      minVal: 1,
      maxVal: 10000,
      stepVal: 1,
    };
  }
  set textFileMaxLineModel(model: IObsInput<number>) {
    this.transcriptionService.setTextFileMaxLine(model.value);
  }

  get textFileLineTimeToLiveModel(): IObsNumberInputValue {
    return {
      name: 'transcriptionTextFileLineTimeToLive',
      description: $t('settings.transcription.textFileLineTimeToLive'),
      value: this.transcriptionService.state.textFileLineTimeToLive,
      enabled: true,
      minVal: 0,
      maxVal: 60000, // 1 minute
      stepVal: 500, // 500 milliseconds
    };
  }
  set textFileLineTimeToLiveModel(model: IObsInput<number>) {
    this.transcriptionService.setTextFileLineTimeToLive(model.value);
  }
}
