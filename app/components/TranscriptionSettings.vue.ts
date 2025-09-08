import * as remote from '@electron/remote';
import { ObsBoolInput, ObsIntInput, ObsListInput, ObsPathInput } from 'components/obs/inputs';
import {
  IObsInput,
  IObsListInput,
  IObsNumberInputValue,
  IObsPathInputValue,
} from 'components/obs/inputs/ObsInput';
import { Subscription } from 'rxjs';
import { Inject } from 'services/core/injector';
import { $t } from 'services/i18n';
import {
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

  help = $t('settings.transcription.help');
  openHelp() {
    const url = 'https://qa.nicovideo.jp/faq/show/24942?site_domain=default';
    remote.shell.openExternal(url);
  }

  created() {
    this.modelStatusSubscription = this.transcriptionService.modelsStatus$.subscribe(status => {
      this.modelsStatus = status;
    });
    this.modelsStatus = this.transcriptionService.modelsStatus();

    this.textSubscription = this.transcriptionService.lines$.subscribe(
      (lines: { texts: string[]; partial: string }) => {
        if (lines.partial.length > 0) {
          this.previewText = lines.partial;
        } else {
          // texts の最終行を表示
          this.previewText = lines.texts.length > 0 ? lines.texts[lines.texts.length - 1] : '';
        }
      },
    );

    this.isActiveSubscription = this.transcriptionService.isActive$.subscribe(isActive => {
      this.isActive = isActive;
    });
    this.isActive = this.transcriptionService.isActive();
    this.transcriptionService.updateAudioDevices();
  }

  beforeDestroy() {
    this.isActiveSubscription.unsubscribe();
    this.textSubscription.unsubscribe();
    this.modelStatusSubscription.unsubscribe();
  }

  preview = $t('settings.transcription.preview');
  get disabledReason(): string {
    if (!this.transcriptionService.state.enabled) {
      return $t('settings.transcription.disabledReason.disabled');
    }
    if (this.transcriptionService.getAudioDeviceList().length === 0) {
      return $t('settings.transcription.disabledReason.noAudioDevice');
    }
    if (!this.transcriptionService.state.audioDeviceId) {
      return $t('settings.transcription.disabledReason.noAudioSource');
    }
    if (!this.transcriptionService.isVoskModelReady()) {
      return $t('settings.transcription.disabledReason.noVoskModel');
    }
    return '';
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

  downloadButtonText = $t('settings.transcription.downloadVoskModel');

  get isDownloadButtonEnabled(): boolean {
    return this.modelStatus.state === 'not_downloaded';
  }

  downloadVoskModel(): void {
    this.transcriptionService.startDownloadVoskModel(this.transcriptionService.state.voskModelName);
  }

  deleteButtonText = $t('settings.transcription.deleteVoskModel');

  get isDeleteButtonEnabled(): boolean {
    return this.transcriptionService.state.voskModelName && this.modelStatus.state === 'downloaded';
  }

  deleteVoskModel(): void {
    this.transcriptionService.deleteVoskModel(this.transcriptionService.state.voskModelName);
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

  commentSectionTitle = $t('settings.transcription.comment.sectionTitle');
  commentSectionNotice1 = $t('settings.transcription.comment.notice1');
  commentSectionNotice2 = $t('settings.transcription.comment.notice2');
  get commentPostDelayModel(): IObsNumberInputValue {
    return {
      name: 'transcriptionCommentPostDelay',
      description: $t('settings.transcription.comment.postDelay'),
      value: this.transcriptionService.state.commentPostDelay,
      enabled: true,
      minVal: 0,
      maxVal: 10000, // 10 seconds
      stepVal: 100, // 100 milliseconds
    };
  }
  set commentPostDelayModel(model: IObsInput<number>) {
    this.transcriptionService.setCommentPostDelay(model.value);
  }

  get commentVposOffsetModel(): IObsNumberInputValue {
    return {
      name: 'transcriptionCommentVposOffset',
      description: $t('settings.transcription.comment.vposOffset'),
      value: this.transcriptionService.state.commentVposOffset,
      enabled: true,
      minVal: -10000, // -10 seconds
      maxVal: 10000, // 10 seconds
      stepVal: 100, // 100 milliseconds
    };
  }
  set commentVposOffsetModel(model: IObsInput<number>) {
    this.transcriptionService.setCommentVposOffset(model.value);
  }

  textFileSectionTitle = $t('settings.transcription.textFile.sectionTitle');
  get textFileEnabledModel(): IObsInput<boolean> {
    return {
      name: 'enableTranscriptionTextFile',
      description: $t('settings.transcription.textFile.enable'),
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
      description: $t('settings.transcription.textFile.path'),
      value: this.transcriptionService.state.textFilePath ?? '',
      enabled: false,
      filters: [{ name: 'Text Files', extensions: ['txt'] }],
    };
  }
  set textFilePathModel(model: IObsPathInputValue) {
    this.transcriptionService.setTextFilePath(model.value);
  }

  get textFileMaxLineModel(): IObsNumberInputValue {
    return {
      name: 'transcriptionTextFileMaxLine',
      description: $t('settings.transcription.textFile.maxLine'),
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
      description: $t('settings.transcription.textFile.lineTimeToLive'),
      value: this.transcriptionService.state.textFileLineTimeToLive,
      enabled: true,
      minVal: 500,
      maxVal: 60000, // 1 minute
      stepVal: 500, // 500 milliseconds
    };
  }
  set textFileLineTimeToLiveModel(model: IObsInput<number>) {
    this.transcriptionService.setTextFileLineTimeToLive(model.value);
  }
}
