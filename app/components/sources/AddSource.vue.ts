import Display from 'components/shared/Display.vue';
import ModalLayout from 'components/shared/ModalLayout.vue';
import Selector from 'components/shared/Selector.vue';
import { Inject } from 'services/core/injector';
import { $t } from 'services/i18n';
import { NVoiceCharacterService, NVoiceCharacterType } from 'services/nvoice-character';
import { ScenesService } from 'services/scenes';
import {
  ISourceAddOptions,
  ISourceApi,
  ISourcesServiceApi,
  TSelectableSourceType,
  TSourceType,
} from 'services/sources';
import { TranscriptionSourceService } from 'services/transcription/transcription-source';
import { WindowsService } from 'services/windows';
import Vue from 'vue';
import { Component } from 'vue-property-decorator';

@Component({
  components: { ModalLayout, Selector, Display },
})
export default class AddSource extends Vue {
  @Inject() private sourcesService: ISourcesServiceApi;
  @Inject() private scenesService: ScenesService;
  @Inject() private windowsService: WindowsService;
  @Inject() private nVoiceCharacterService: NVoiceCharacterService;
  @Inject() private transcriptionSourceService: TranscriptionSourceService;

  name = '';
  error = '';
  // @ts-expect-error: ts2729: use before initialization

  sourceType = this.windowsService.getChildWindowQueryParams().sourceType as TSelectableSourceType;
  // @ts-expect-error: ts2729: use before initialization
  sourceAddOptions = this.windowsService.getChildWindowQueryParams()
    .sourceAddOptions as ISourceAddOptions;

  canAddNew = true;
  adding = false;

  get nVoiceCharacterType(): NVoiceCharacterType {
    return this.sourceAddOptions.propertiesManagerSettings.nVoiceCharacterType || 'near';
  }

  // @ts-expect-error: ts2729: use before initialization
  sources = this.sourcesService.getSources().filter(source => {
    const comparison = {
      type: this.sourceType as TSourceType,
      propertiesManager: this.sourceAddOptions.propertiesManager,
    };
    return (
      source.isSameType(
        comparison.propertiesManager === 'nvoice-character'
          ? { ...comparison, nVoiceCharacterType: this.nVoiceCharacterType }
          : comparison,
      ) && source.sourceId !== this.scenesService.activeSceneId
    );
  });

  existingSources = this.sources.map(source => {
    return { name: source.name, value: source.sourceId };
  });

  selectedSourceId = this.sources[0] ? this.sources[0].sourceId : null;

  mounted() {
    if (this.sourceAddOptions.propertiesManager === 'custom-cast-ndi') {
      this.name = this.sourcesService.suggestName($t('source-props.custom_cast_ndi_source.name'));
    } else if (this.sourceAddOptions.propertiesManager === 'nvoice-character') {
      const type = this.sourceAddOptions.propertiesManagerSettings.nVoiceCharacterType || 'near';
      this.name = this.sourcesService.suggestName($t(`source-props.${type}.name`));
    } else {
      const sourceType =
        this.sourceType &&
        this.sourcesService
          .getAvailableSourcesTypesList()
          .find(sourceTypeDef => sourceTypeDef.value === this.sourceType);

      this.name = this.sourcesService.suggestName(this.sourceType && sourceType.description);
    }

    if (this.sourceType === 'scene') this.canAddNew = false;
    // ソースとしては1つだけ登録可能とする
    if (this.sources.length > 0 && this.sources[0].type === 'nair-rtvc-source')
      this.canAddNew = false;
  }

  addExisting() {
    const scene = this.scenesService.activeScene;
    if (!scene.canAddSource(this.selectedSourceId)) {
      // for now only a scene-source can be a problem
      alert($t('sources.circularReferenceMessage'));
      return;
    }
    this.adding = true;
    this.scenesService.activeScene.addSource(this.selectedSourceId);
    this.close();
  }

  close() {
    this.windowsService.closeChildWindow();
  }

  addNew() {
    if (!this.name) {
      this.error = $t('sources.sourceNameIsRequired');
      return;
    }

    let s: {
      source: ISourceApi;
      options: ISourceAddOptions;
      forceSkipProperties?: boolean;
    };

    if (
      this.sourceType === 'near' ||
      this.sourceAddOptions.propertiesManager === 'nvoice-character'
    ) {
      const type: NVoiceCharacterType =
        this.sourceAddOptions.propertiesManagerSettings.nVoiceCharacterType || 'near';
      s = this.nVoiceCharacterService.createNVoiceCharacterSource(type, this.name);
    } else if (this.sourceType === 'text_transcription') {
      s = this.transcriptionSourceService.createTextTranscriptionSourceAndOption(
        this.name,
        this.sourceAddOptions,
      );
    } else if (this.sourceType === 'ffmpeg_source_replay') {
      s = this.createReplaySourceAndOption(this.name);
    } else {
      s = {
        source: this.sourcesService.createSource(
          this.name,
          this.sourceType,
          {}, // IPCがundefinedをnullに変換するのでデフォルト値は使わない
          {
            propertiesManager: this.sourceAddOptions.propertiesManager,
            propertiesManagerSettings: this.sourceAddOptions.propertiesManagerSettings,
          },
        ),
        options: {},
      };
    }

    this.adding = true;
    this.scenesService.activeScene.addSource(s.source.sourceId, s.options);

    if (s.source.hasProps() && !s.forceSkipProperties) {
      this.sourcesService.showSourceProperties(s.source.sourceId);
    } else {
      this.close();
    }
  }

  get selectedSource() {
    return this.sourcesService.getSource(this.selectedSourceId);
  }

  createReplaySourceAndOption(name: string): {
    source: ISourceApi;
    options: ISourceAddOptions;
    forceSkipProperties?: boolean;
  } {
    return {
      source: this.sourcesService.createSource(
        this.name,
        'ffmpeg_source',
        {},
        {
          propertiesManager: 'replay',
          propertiesManagerSettings: this.sourceAddOptions.propertiesManagerSettings,
        },
      ),
      options: {},
    };
  }
}
