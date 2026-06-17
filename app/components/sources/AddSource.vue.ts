import Display from 'components/shared/Display.vue';
import ModalLayout from 'components/shared/ModalLayout.vue';
import Selector from 'components/shared/Selector.vue';
import { $t } from 'services/i18n';
import { NVoiceCharacterService, NVoiceCharacterType } from 'services/nvoice-character';
import { ScenesService } from 'services/scenes';
import {
  ISourceAddOptions,
  ISourceApi,
  SourcesService,
  TSelectableSourceType,
  TSourceType,
} from 'services/sources';
import { TranscriptionSourceService } from 'services/transcription/transcription-source';
import { WindowsService } from 'services/windows';
import { defineComponent, toRaw } from 'vue';

export default defineComponent({
  name: 'AddSource',

  components: { ModalLayout, Selector, Display },

  data() {
    const sourceType = WindowsService.instance().getChildWindowQueryParams().sourceType as TSelectableSourceType;
    const sourceAddOptions = WindowsService.instance().getChildWindowQueryParams().sourceAddOptions as ISourceAddOptions;
    const nVoiceCharacterType: NVoiceCharacterType = sourceAddOptions.propertiesManagerSettings.nVoiceCharacterType || 'near';

    const sources = SourcesService.instance().getSources().filter((source) => {
      const comparison = {
        type: sourceType as TSourceType,
        propertiesManager: sourceAddOptions.propertiesManager,
      };
      return (
        source.isSameType(
          comparison.propertiesManager === 'nvoice-character'
            ? { ...comparison, nVoiceCharacterType }
            : comparison,
        ) && source.sourceId !== ScenesService.instance().activeSceneId
      );
    });

    return {
      name: '',
      error: '',
      sourceType,
      sourceAddOptions,
      canAddNew: true,
      adding: false,
      sources,
      existingSources: sources.map((source) => ({ name: source.name, value: source.sourceId })),
      selectedSourceId: sources[0] ? sources[0].sourceId : null as string | null,
    };
  },

  computed: {
    nVoiceCharacterType(): NVoiceCharacterType {
      return this.sourceAddOptions.propertiesManagerSettings.nVoiceCharacterType || 'near';
    },

    selectedSource() {
      return SourcesService.instance().getSource(this.selectedSourceId);
    },
  },

  mounted(): void {
    if (this.sourceAddOptions.propertiesManager === 'custom-cast-ndi') {
      this.name = SourcesService.instance().suggestName($t('source-props.custom_cast_ndi_source.name'));
    } else if (this.sourceAddOptions.propertiesManager === 'nvoice-character') {
      const type = this.sourceAddOptions.propertiesManagerSettings.nVoiceCharacterType || 'near';
      this.name = SourcesService.instance().suggestName($t(`source-props.${type}.name`));
    } else {
      const sourceType = this.sourceType
        && SourcesService.instance()
          .getAvailableSourcesTypesList()
          .find((sourceTypeDef) => sourceTypeDef.value === this.sourceType);

      this.name = SourcesService.instance().suggestName(this.sourceType && sourceType.description);
    }

    if (this.sourceType === 'scene') this.canAddNew = false;
    // ソースとしては1つだけ登録可能とする
    if (this.sources.length > 0 && this.sources[0].type === 'nair-rtvc-source') this.canAddNew = false;
  },

  methods: {
    addExisting(): void {
      const scene = ScenesService.instance().activeScene;
      if (!scene.canAddSource(this.selectedSourceId)) {
        // for now only a scene-source can be a problem
        alert($t('sources.circularReferenceMessage'));
        return;
      }
      this.adding = true;
      ScenesService.instance().activeScene.addSource(this.selectedSourceId);
      this.close();
    },

    close(): void {
      WindowsService.instance().closeChildWindow();
    },

    addNew(): void {
      if (!this.name) {
        this.error = $t('sources.sourceNameIsRequired');
        return;
      }

      const sourceAddOptions = toRaw(this.sourceAddOptions);

      let s: {
        source: ISourceApi;
        options: ISourceAddOptions;
        forceSkipProperties?: boolean;
      };

      if (
        this.sourceType === 'near'
        || sourceAddOptions.propertiesManager === 'nvoice-character'
      ) {
        const type: NVoiceCharacterType = sourceAddOptions.propertiesManagerSettings.nVoiceCharacterType || 'near';
        s = NVoiceCharacterService.instance().createNVoiceCharacterSource(type, this.name);
      } else if (this.sourceType === 'text_transcription') {
        s = TranscriptionSourceService.instance().createTextTranscriptionSourceAndOption(
          this.name,
          sourceAddOptions,
        );
      } else if (this.sourceType === 'ffmpeg_source_replay') {
        s = this.createReplaySourceAndOption(this.name);
      } else {
        s = {
          source: SourcesService.instance().createSource(
            this.name,
            this.sourceType,
            {}, // IPCがundefinedをnullに変換するのでデフォルト値は使わない
            {
              propertiesManager: sourceAddOptions.propertiesManager,
              propertiesManagerSettings: sourceAddOptions.propertiesManagerSettings,
            },
          ),
          options: {},
        };
      }

      this.adding = true;
      ScenesService.instance().activeScene.addSource(s.source.sourceId, s.options);

      if (s.source.hasProps() && !s.forceSkipProperties) {
        SourcesService.instance().showSourceProperties(s.source.sourceId);
      } else {
        this.close();
      }
    },

    createReplaySourceAndOption(name: string): {
      source: ISourceApi;
      options: ISourceAddOptions;
      forceSkipProperties?: boolean;
    } {
      const sourceAddOptions = toRaw(this.sourceAddOptions);
      return {
        source: SourcesService.instance().createSource(
          name,
          'ffmpeg_source',
          {},
          {
            propertiesManager: 'replay',
            propertiesManagerSettings: sourceAddOptions.propertiesManagerSettings,
          },
        ),
        options: {},
      };
    },
  },
});
