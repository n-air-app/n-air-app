import Step from 'components/nicolive-area/Step.vue';
import ModalLayout from 'components/shared/ModalLayout.vue';
import NavItem from 'components/shared/NavItem.vue';
import NavMenu from 'components/shared/NavMenu.vue';
import { $t } from 'services/i18n';
import {
  NicoliveProgramSelectorService,
  providerTypes as _providerTypes,
  selectionSteps as _selectionSteps,
  steps as _steps,
  TProviderType,
  TStep,
} from 'services/nicolive-program/nicolive-program-selector';
import { StreamingService } from 'services/streaming';
import { WindowsService } from 'services/windows';
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'NicoliveProgramSelector',

  components: { ModalLayout, NavMenu, NavItem, Step },

  data() {
    return {
      providerTypes: _providerTypes,
      steps: _steps,
      selectionSteps: _selectionSteps,
      BLANK: '-',
    };
  },

  computed: {
    currentStep: {
      get(): TStep {
        return NicoliveProgramSelectorService.instance().state.currentStep;
      },
      set(step: TStep) {
        NicoliveProgramSelectorService.instance().backTo(step);
      },
    },

    candidateChannels() {
      return NicoliveProgramSelectorService.instance().state.candidateChannels;
    },

    candidatePrograms() {
      return NicoliveProgramSelectorService.instance().state.candidatePrograms;
    },
  },

  beforeUnmount(): void {
    // 状態初期化
    NicoliveProgramSelectorService.instance().reset();
  },

  methods: {
    onSelectProviderType(providerType: TProviderType): void {
      if (NicoliveProgramSelectorService.instance().state.isLoading) return;
      NicoliveProgramSelectorService.instance().onSelectProviderType(providerType);
    },

    onSelectChannel(id: string, name: string): void {
      if (NicoliveProgramSelectorService.instance().state.isLoading) return;
      NicoliveProgramSelectorService.instance().onSelectChannel(id, name);
    },

    onSelectBroadcastingProgram(id: string, title: string): void {
      if (NicoliveProgramSelectorService.instance().state.isLoading) return;
      NicoliveProgramSelectorService.instance().onSelectBroadcastingProgram(id, title);
    },

    isCompletedStep(step: TStep): boolean {
      return NicoliveProgramSelectorService.instance().isCompletedStep(step);
    },

    shouldEnableNavItem(step: TStep): boolean {
      return (
        !NicoliveProgramSelectorService.instance().state.isLoading
        && NicoliveProgramSelectorService.instance().isCompletedOrCurrentStep(step)
      );
    },

    getSelectedValueForDisplay(navItemStep: TStep): string {
      const { selectedProviderType, selectedChannel, selectedChannelProgram } =
        NicoliveProgramSelectorService.instance().state;
      switch (navItemStep) {
        case 'providerTypeSelect':
          return this.getProviderTypeProgramText(selectedProviderType) || this.BLANK;
        case 'channelSelect':
          return selectedChannel?.name || this.BLANK;
        case 'programSelect':
          return selectedChannelProgram?.title || this.BLANK;
        default:
          return this.BLANK;
      }
    },

    canShowNoProgramsSection(): boolean {
      return (
        !NicoliveProgramSelectorService.instance().state.isLoading
        && NicoliveProgramSelectorService.instance().state.candidatePrograms.length <= 0
      );
    },

    getProviderTypeProgramText(providerType: TProviderType): string {
      return $t(`streaming.nicoliveProgramSelector.providerTypeProgram.${providerType}`);
    },

    getStepTitleForMenu(step: TStep): string {
      return $t(`streaming.nicoliveProgramSelector.steps.${step}.menuTitle`);
    },

    getStepTitle(step: TStep): string {
      return $t(`streaming.nicoliveProgramSelector.steps.${step}.title`);
    },

    getStepDescription(step: TStep): string {
      return $t(`streaming.nicoliveProgramSelector.steps.${step}.description`);
    },

    ok(): void {
      StreamingService.instance().toggleStreamingAsync({
        nicoliveProgramSelectorResult: {
          providerType: NicoliveProgramSelectorService.instance().state.selectedProviderType,
          channelProgramId:
            NicoliveProgramSelectorService.instance().state.selectedChannelProgram?.id ?? undefined,
        },
      });
      WindowsService.instance().closeChildWindow();
    },
  },
});
