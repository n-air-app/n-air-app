import * as remote from '@electron/remote';
import { ObsBoolInput, ObsIntInput, ObsListInput, ObsPathInput } from 'components/obs/inputs';
import {
  IObsInput,
  IObsListInput,
  IObsNumberInputValue,
  IObsPathInputValue,
} from 'components/obs/inputs/ObsInput';
import TocSection from 'components/shared/TocSection.vue';
import { Subscription } from 'rxjs';
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
  VOSK_MODEL_NAMES,
  VoskModelStatus,
  voskModelStatusToString,
} from 'services/transcription/transcription';
import { TranscriptionSourceService } from 'services/transcription/transcription-source';
import { TranscriptionSourceUsageService } from 'services/transcription/transcription-source-usage';
import { UserService } from 'services/user';
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'TranscriptionSettings',
  components: {
    ObsBoolInput,
    ObsIntInput,
    ObsListInput,
    ObsPathInput,
    TocSection,
  },
  data() {
    return {
      modelsStatus: {} as Dictionary<VoskModelStatus>,
      modelStatusSubscription: null as Subscription | null,
      textSubscription: null as Subscription | null,
      previewText: '' as string,
      activeStatusSubscription: null as Subscription | null,
      activeStatus: 'disabled' as ActiveStatus,
      help: $t('settings.transcription.help'),
      preview: $t('settings.transcription.preview'),
      enabledLabel: $t('settings.transcription.enable'),
      downloadButtonText: $t('settings.transcription.downloadVoskModel'),
      cancelButtonText: $t('settings.transcription.cancelVoskModel'),
      deleteButtonText: $t('settings.transcription.deleteVoskModel'),
      commentSectionTitle: $t('settings.transcription.comment.sectionTitle'),
      commentSectionNotice1: $t('settings.transcription.comment.notice1'),
      commentSectionNotice2: $t('settings.transcription.comment.notice2'),
      commentSectionNotice3: $t('settings.transcription.comment.notice3'),
      commentSectionNotice4: $t('settings.transcription.comment.notice4'),
      textFileSectionTitle: $t('settings.transcription.textFile.sectionTitle'),
      transcriptionSourceInActiveScene: false,
      transcriptionSourceInActiveSceneSubscription: null as Subscription | null,
    };
  },
  computed: {
    disabledReason(): string {
      return $t(`settings.transcription.disabledReason.${this.activeStatus}`);
    },
    modelStatus(): VoskModelStatus | { state: 'not_available' } {
      return (
        this.modelsStatus[TranscriptionService.instance().state.voskModelName] || { state: 'not_available' }
      );
    },
    enabled: {
      get(): boolean {
        return TranscriptionService.instance().state.enabled ?? false;
      },
      set(enable: boolean) {
        const lastEnabled = TranscriptionService.instance().state.enabled ?? false;
        TranscriptionService.instance().setEnabled(enable);
        if (!lastEnabled && enable) {
          if (!this.hasVoskModelDownloadedOrInProgress) {
            if (
              remote.dialog.showMessageBoxSync(remote.getCurrentWindow(), {
                type: 'question',
                buttons: [$t('common.yes'), $t('common.later')],
                defaultId: 0,
                cancelId: 1,
                message: $t('settings.transcription.downloadModelConfirm.message'),
                detail: $t('settings.transcription.downloadModelConfirm.detail'),
                noLink: true,
              }) === 0
            ) {
              const modelToDownload = VOSK_MODEL_NAMES[0];
              TranscriptionService.instance().setModelName(modelToDownload);
              TranscriptionService.instance().startDownloadVoskModel(modelToDownload);
            }
          }

          const hasOutputDestination = this.transcriptionSourceInActiveScene || (UserService.instance().isNiconicoLoggedIn() && this.commentEnabled);

          if (!hasOutputDestination) {
            const detailKey = UserService.instance().isNiconicoLoggedIn()
              ? 'settings.transcription.addOutputDestinationConfirm.detailWithComment'
              : 'settings.transcription.addOutputDestinationConfirm.detail';

            if (
              remote.dialog.showMessageBoxSync(remote.getCurrentWindow(), {
                type: 'question',
                buttons: [$t('common.yes'), $t('common.later')],
                defaultId: 0,
                cancelId: 1,
                message: $t('settings.transcription.addOutputDestinationConfirm.message'),
                detail: $t(detailKey),
                noLink: true,
              }) === 0
            ) {
              this.addTranscriptionSourceToActiveScene();
            }
          }

          TranscriptionService.instance().initializeText();
        }
      },
    },
    hasVoskModelDownloadedOrInProgress(): boolean {
      return Object.values(this.modelsStatus).some(
        (status: any) =>
          status.state === 'downloaded'
          || status.state === 'downloading'
          || status.state === 'installing',
      );
    },
    voskModelModel: {
      get(): IObsListInput<string> {
        return {
          name: 'voskModel',
          description: '',
          value: TranscriptionService.instance().state.voskModelName ?? '',
          options: TranscriptionService.instance().getVoskModels().map((model: any) => {
            const status = this.modelsStatus[model.name];
            return {
              value: model.name,
              description: `${model.description}: ${status ? voskModelStatusToString(status) : ''}`,
            };
          }),
        };
      },
      set(model: IObsListInput<string>) {
        TranscriptionService.instance().setModelName(model.value);
      },
    },
    isDownloadButtonEnabled(): boolean {
      return (
        (this.modelStatus as any).state === 'not_downloaded'
        || (this.modelStatus as any).state === 'download_error'
        || (this.modelStatus as any).state === 'cancelled'
      );
    },
    isCancelButtonEnabled(): boolean {
      return (this.modelStatus as any).state === 'downloading';
    },
    isDeleteButtonEnabled(): boolean {
      return !!(
        TranscriptionService.instance().state.voskModelName
        && ((this.modelStatus as any).state === 'downloaded' || (this.modelStatus as any).state === 'load_error')
      );
    },
    audioSourceIdModel: {
      get(): IObsListInput<string> {
        const sources = TranscriptionService.instance().getAudioDeviceList();
        if (sources.length === 0) {
          return {
            description: $t('settings.transcription.audioSource'),
            name: 'transcriptionAudioSource',
            value: TranscriptionService.instance().state.audioDeviceId ?? '',
            options: [{ description: $t('settings.transcription.noAudioSourceFound'), value: null }],
            enabled: false,
          };
        }
        return {
          description: $t('settings.transcription.audioSource'),
          name: 'transcriptionAudioSource',
          value: TranscriptionService.instance().state.audioDeviceId ?? '',
          options: [
            ...sources.map((source: any) => ({
              description: source.name,
              value: source.id,
            })),
          ],
        };
      },
      set(model: IObsListInput<string>) {
        TranscriptionService.instance().setAudioDeviceId(model.value);
      },
    },
    commentEnabled: {
      get(): boolean {
        return TranscriptionService.instance().state.commentEnabled ?? false;
      },
      set(value: boolean) {
        TranscriptionService.instance().setCommentEnabled(value);
      },
    },
    commentPostDelayModel: {
      get(): IObsNumberInputValue {
        return {
          name: 'transcriptionCommentPostDelay',
          description: $t('settings.transcription.comment.postDelay'),
          value: TranscriptionService.instance().state.commentPostDelay,
          enabled: true,
          minVal: 0,
          maxVal: 10000,
          stepVal: 100,
        };
      },
      set(model: IObsInput<number>) {
        TranscriptionService.instance().setCommentPostDelay(model.value);
      },
    },
    commentVposOffsetModel: {
      get(): IObsNumberInputValue {
        return {
          name: 'transcriptionCommentVposOffset',
          description: $t('settings.transcription.comment.vposOffset'),
          value: TranscriptionService.instance().state.commentVposOffset,
          enabled: true,
          minVal: -10000,
          maxVal: 10000,
          stepVal: 100,
        };
      },
      set(model: IObsInput<number>) {
        TranscriptionService.instance().setCommentVposOffset(model.value);
      },
    },
    commentPositionModel: {
      get(): IObsListInput<CommentPosition> {
        return {
          name: 'transcriptionCommentPosition',
          description: $t('settings.transcription.comment.positionLabel'),
          value: TranscriptionService.instance().state.commentPosition,
          enabled: true,
          options: COMMENT_POSITIONS.map((position) => ({
            description:
              $t(`settings.transcription.comment.position.${position}`)
              + (position === TranscriptionService.defaultState.commentPosition
                ? $t('settings.transcription.comment.defaultSuffix')
                : ''),
            value: position,
          })),
        };
      },
      set(model: IObsListInput<CommentPosition>) {
        TranscriptionService.instance().setCommentPosition(model.value);
      },
    },
    commentSizeModel: {
      get(): IObsListInput<CommentSize> {
        return {
          name: 'transcriptionCommentSize',
          description: $t('settings.transcription.comment.sizeLabel'),
          value: TranscriptionService.instance().state.commentSize,
          enabled: true,
          options: COMMENT_SIZES.map((size) => ({
            description:
              $t(`settings.transcription.comment.size.${size}`)
              + (size === TranscriptionService.defaultState.commentSize
                ? $t('settings.transcription.comment.defaultSuffix')
                : ''),
            value: size,
          })),
        };
      },
      set(model: IObsListInput<CommentSize>) {
        TranscriptionService.instance().setCommentSize(model.value);
      },
    },
    commentFontModel: {
      get(): IObsListInput<CommentFont> {
        return {
          name: 'transcriptionCommentFont',
          description: $t('settings.transcription.comment.fontLabel'),
          value: TranscriptionService.instance().state.commentFont,
          enabled: true,
          options: COMMENT_FONTS.map((font) => ({
            description: $t(`settings.transcription.comment.font.${font}`),
            value: font,
          })),
        };
      },
      set(model: IObsListInput<CommentFont>) {
        TranscriptionService.instance().setCommentFont(model.value);
      },
    },
    commentColorModel: {
      get(): IObsListInput<CommentColor> {
        return {
          name: 'transcriptionCommentColor',
          description: $t('settings.transcription.comment.colorLabel'),
          value: TranscriptionService.instance().state.commentColor,
          enabled: true,
          options: COMMENT_COLORS.map((color) => ({
            description:
              $t(`settings.transcription.comment.color.${color}`)
              + (color === TranscriptionService.defaultState.commentColor
                ? $t('settings.transcription.comment.defaultSuffix')
                : ''),
            value: color,
          })),
        };
      },
      set(model: IObsListInput<CommentColor>) {
        TranscriptionService.instance().setCommentColor(model.value);
      },
    },
    textFileEnabledModel: {
      get(): IObsInput<boolean> {
        return {
          name: 'enableTranscriptionTextFile',
          description: $t('settings.transcription.textFile.enable'),
          value: TranscriptionService.instance().state.textFileEnabled ?? false,
          enabled: true,
        };
      },
      set(model: IObsInput<boolean>) {
        TranscriptionService.instance().setTextFileEnabled(model.value);
      },
    },
    textFilePathModel: {
      get(): IObsPathInputValue {
        return {
          name: 'transcriptionTextFilePath',
          description: $t('settings.transcription.textFile.path'),
          value: TranscriptionService.instance().state.textFilePath ?? '',
          enabled: false,
          filters: [{ name: 'Text Files', extensions: ['txt'] }],
        };
      },
      set(model: IObsPathInputValue) {
        TranscriptionService.instance().setTextFilePath(model.value);
      },
    },
    textFileMaxLineModel: {
      get(): IObsNumberInputValue {
        return {
          name: 'transcriptionTextFileMaxLine',
          description: $t('settings.transcription.textFile.maxLine'),
          value: TranscriptionService.instance().state.textFileMaxLine,
          enabled: true,
          minVal: 1,
          maxVal: 10000,
          stepVal: 1,
        };
      },
      set(model: IObsInput<number>) {
        TranscriptionService.instance().setTextFileMaxLine(model.value);
      },
    },
    textFileLineTimeToLiveModel: {
      get(): IObsNumberInputValue {
        return {
          name: 'transcriptionTextFileLineTimeToLive',
          description: $t('settings.transcription.textFile.lineTimeToLive'),
          value: TranscriptionService.instance().state.textFileLineTimeToLive,
          enabled: true,
          minVal: 500,
          maxVal: 60000,
          stepVal: 500,
        };
      },
      set(model: IObsInput<number>) {
        TranscriptionService.instance().setTextFileLineTimeToLive(model.value);
      },
    },
  },
  created() {
    this.modelStatusSubscription = TranscriptionService.instance().modelsStatus$.subscribe((status: any) => {
      this.modelsStatus = status;
    });
    this.modelsStatus = TranscriptionService.instance().modelsStatus();

    this.textSubscription = TranscriptionService.instance().lines$.subscribe(
      (lines: { texts: string[]; partial: string }) => {
        if (lines.partial.length > 0) {
          this.previewText = lines.partial;
        } else {
          this.previewText = lines.texts.length > 0 ? lines.texts[lines.texts.length - 1] : '';
        }
      },
    );

    this.activeStatusSubscription = TranscriptionService.instance().activeStatus$.subscribe((isActive: any) => {
      this.activeStatus = isActive;
    });
    this.activeStatus = TranscriptionService.instance().activeStatus();
    TranscriptionService.instance().updateAudioDevices();

    this.subscribeTranscriptionSourceUsage();
  },
  beforeUnmount() {
    this.unsubscribeTranscriptionSourceUsage();
    this.activeStatusSubscription!.unsubscribe();
    this.textSubscription!.unsubscribe();
    this.modelStatusSubscription!.unsubscribe();
  },
  methods: {
    isNiconicoLoggedIn(): boolean {
      return UserService.instance().isNiconicoLoggedIn();
    },
    openHelp() {
      const url = 'https://qa.nicovideo.jp/faq/show/24942?site_domain=default';
      remote.shell.openExternal(url);
    },
    subscribeTranscriptionSourceUsage() {
      this.transcriptionSourceInActiveSceneSubscription = TranscriptionSourceUsageService.instance().state$.subscribe((state: any) => {
        this.transcriptionSourceInActiveScene = state.existsInActiveScene;
      });
      this.transcriptionSourceInActiveScene = TranscriptionSourceUsageService.instance().state.existsInActiveScene;
    },
    unsubscribeTranscriptionSourceUsage() {
      this.transcriptionSourceInActiveSceneSubscription?.unsubscribe();
    },
    addTranscriptionSourceToActiveScene(): void {
      TranscriptionSourceService.instance().addTextTranscriptionSourceToActiveScene();
    },
    downloadVoskModel(): void {
      TranscriptionService.instance().startDownloadVoskModel(TranscriptionService.instance().state.voskModelName);
    },
    cancelDownloadVoskModel(): void {
      const wasCancelled = TranscriptionService.instance().cancelDownloadVoskModel(
        TranscriptionService.instance().state.voskModelName,
      );
      if (wasCancelled) {
        console.log('Cancelled download for model:', TranscriptionService.instance().state.voskModelName);
      }
    },
    deleteVoskModel(): void {
      TranscriptionService.instance().deleteVoskModel(TranscriptionService.instance().state.voskModelName);
    },
  },
});
