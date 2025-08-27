import {
  ObsBoolInput,
  ObsButtonInput,
  ObsListInput,
  ObsIntInput,
  ObsPathInput,
} from 'components/obs/inputs';
import {
  IObsButtonInputValue,
  IObsInput,
  IObsListInput,
  IObsNumberInputValue,
  IObsPathInputValue,
} from 'components/obs/inputs/ObsInput';
import { merge, Subscription } from 'rxjs';
import { Inject } from 'services/core/injector';
import { $t } from 'services/i18n';
import {
  TimestampedText,
  TranscriptionService,
  VoskModelStatus,
  voskModelStatusToString,
} from 'services/transcription/transcription';
import { UserService } from 'services/user';
import Vue from 'vue';
import { Component } from 'vue-property-decorator';

@Component({
  components: {
    ObsBoolInput,
    ObsButtonInput,
    ObsIntInput,
    ObsListInput,
    ObsPathInput,
  },
})
export default class TranscriptionSettings extends Vue {
  @Inject() transcriptionService: TranscriptionService;
  @Inject() userService: UserService;

  isNiconicoLoggedIn(): boolean {
    return this.userService.isNiconicoLoggedIn();
  }

  modelsStatus: Dictionary<VoskModelStatus> = {};

  modelStatusSubscription: Subscription;
  textSubscription: Subscription;
  previewText: string = '';
  isActiveSubscription: Subscription;
  isActive: boolean = false;

  created() {
    this.modelStatusSubscription = this.transcriptionService.modelsStatus$.subscribe(status => {
      this.modelsStatus = status;
    });
    this.modelsStatus = this.transcriptionService.modelsStatus;

    this.textSubscription = merge(
      this.transcriptionService.text$,
      this.transcriptionService.partial$,
    ).subscribe((text: TimestampedText | string) => {
      if (typeof text === 'string') {
        this.previewText = text;
      } else {
        this.previewText = text.text;
      }
    });

    this.isActiveSubscription = this.transcriptionService.isActive$.subscribe(isActive => {
      this.isActive = isActive;
    });
  }

  beforeDestroy() {
    this.isActiveSubscription.unsubscribe();
    this.textSubscription.unsubscribe();
    this.modelStatusSubscription.unsubscribe();
  }

  get modelStatus(): VoskModelStatus | { state: 'not_available' } {
    return (
      this.modelsStatus[this.transcriptionService.state.voskModelName] || { state: 'not_available' }
    );
  }

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

  get voskModelModel(): IObsListInput<string> {
    console.log('** voskModel:', this.transcriptionService.getVoskModels()); // DEBUG
    return {
      name: 'voskModel',
      description: $t('settings.transcription.voskModel'),
      value: this.transcriptionService.state.voskModelName ?? '',
      options: this.transcriptionService.getVoskModels().map(model => {
        const status = this.modelsStatus[model.name];
        return {
          value: model.name,
          description: `${model.description}: ${status ? voskModelStatusToString(status) : ''}`,
        };
      }),
    };
  }

  set voskModelModel(model: IObsListInput<string>) {
    this.transcriptionService.setModelName(model.value);
  }

  get downloadButtonModel(): IObsButtonInputValue {
    return {
      name: 'downloadVoskModel',
      description: $t('settings.transcription.downloadVoskModel'),
      enabled: this.modelStatus.state === 'not_downloaded',
      type: 'OBS_PROPERTY_BUTTON',
      onClick: () => {
        this.transcriptionService.startDownloadVoskModel(
          this.transcriptionService.state.voskModelName,
        );
      },
    };
  }
  get deleteButtonModel(): IObsButtonInputValue {
    return {
      name: 'deleteVoskModel',
      description: $t('settings.transcription.deleteVoskModel'),
      enabled:
        this.transcriptionService.state.voskModelName && this.modelStatus.state === 'downloaded',
      type: 'OBS_PROPERTY_BUTTON',
      onClick: () => {
        this.transcriptionService.deleteVoskModel(this.transcriptionService.state.voskModelName);
      },
    };
  }

  get audioSourceIdModel(): IObsListInput<string> {
    const sources = this.transcriptionService.getAudioDeviceList();
    if (sources.length === 0) {
      return {
        description: $t('settings.transcription.audioSource'),
        name: 'transcriptionAudioSource',
        value: this.transcriptionService.state.audioDeviceId ?? '',
        options: [{ description: $t('settings.transcription.noAudioSourceFound'), value: null }],
        enabled: false,
      };
    }
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

  get commentDelayModel(): IObsNumberInputValue {
    return {
      name: 'transcriptionCommentDelay',
      description: $t('settings.transcription.commentDelay'),
      value: this.transcriptionService.state.commentDelay,
      enabled: true,
      minVal: 0,
      maxVal: 10000, // 10 seconds
      stepVal: 100, // 100 milliseconds
    };
  }
  set commentDelayModel(model: IObsInput<number>) {
    this.transcriptionService.setCommentDelay(model.value);
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
