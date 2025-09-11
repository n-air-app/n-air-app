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
  COMMENT_COLORS,
  COMMENT_FONTS,
  COMMENT_POSITIONS,
  COMMENT_SIZES,
  CommentColor,
  CommentFont,
  CommentPosition,
  CommentSize,
} from 'services/transcription/CommentModifier';
import {
  ActiveStatus,
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
  activeStatusSubscription: Subscription;
  activeStatus: ActiveStatus = 'disabled';

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

    this.activeStatusSubscription = this.transcriptionService.activeStatus$.subscribe(isActive => {
      this.activeStatus = isActive;
    });
    this.activeStatus = this.transcriptionService.activeStatus();
    this.transcriptionService.updateAudioDevices();
  }

  beforeDestroy() {
    this.activeStatusSubscription.unsubscribe();
    this.textSubscription.unsubscribe();
    this.modelStatusSubscription.unsubscribe();
  }

  preview = $t('settings.transcription.preview');
  get disabledReason(): string {
    return $t(`settings.transcription.disabledReason.${this.activeStatus}`);
  }

  get modelStatus(): VoskModelStatus | { state: 'not_available' } {
    return (
      this.modelsStatus[this.transcriptionService.state.voskModelName] || { state: 'not_available' }
    );
  }

  enabledLabel = $t('settings.transcription.enable');
  get enabled(): boolean {
    return this.transcriptionService.state.enabled ?? false;
  }
  set enabled(model: boolean) {
    this.transcriptionService.setEnabled(model);
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

  get commentPositionModel(): IObsListInput<CommentPosition> {
    return {
      name: 'transcriptionCommentPosition',
      description: $t('settings.transcription.comment.positionLabel'),
      value: this.transcriptionService.state.commentPosition,
      enabled: true,
      options: COMMENT_POSITIONS.map(position => ({
        description:
          $t(`settings.transcription.comment.position.${position}`) +
          (position === TranscriptionService.defaultState.commentPosition
            ? $t('settings.transcription.comment.defaultSuffix')
            : ''),
        value: position,
      })),
    };
  }
  set commentPositionModel(model: IObsListInput<CommentPosition>) {
    this.transcriptionService.setCommentPosition(model.value);
  }

  get commentSizeModel(): IObsListInput<CommentSize> {
    return {
      name: 'transcriptionCommentSize',
      description: $t('settings.transcription.comment.sizeLabel'),
      value: this.transcriptionService.state.commentSize,
      enabled: true,
      options: COMMENT_SIZES.map(size => ({
        description:
          $t(`settings.transcription.comment.size.${size}`) +
          (size === TranscriptionService.defaultState.commentSize
            ? $t('settings.transcription.comment.defaultSuffix')
            : ''),
        value: size,
      })),
    };
  }
  set commentSizeModel(model: IObsListInput<CommentSize>) {
    this.transcriptionService.setCommentSize(model.value);
  }

  get commentFontModel(): IObsListInput<CommentFont> {
    return {
      name: 'transcriptionCommentFont',
      description: $t('settings.transcription.comment.fontLabel'),
      value: this.transcriptionService.state.commentFont,
      enabled: true,
      options: COMMENT_FONTS.map(font => ({
        description: $t(`settings.transcription.comment.font.${font}`),
        value: font,
      })),
    };
  }
  set commentFontModel(model: IObsListInput<CommentFont>) {
    this.transcriptionService.setCommentFont(model.value);
  }

  get commentColorModel(): IObsListInput<CommentColor> {
    return {
      name: 'transcriptionCommentColor',
      description: $t('settings.transcription.comment.colorLabel'),
      value: this.transcriptionService.state.commentColor,
      enabled: true,
      options: COMMENT_COLORS.map(color => ({
        description:
          $t(`settings.transcription.comment.color.${color}`) +
          (color === TranscriptionService.defaultState.commentColor
            ? $t('settings.transcription.comment.defaultSuffix')
            : ''),
        value: color,
      })),
    };
  }
  set commentColorModel(model: IObsListInput<CommentColor>) {
    this.transcriptionService.setCommentColor(model.value);
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
