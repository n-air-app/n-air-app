import BoolInput from 'components/obs/inputs/ObsBoolInput.vue';
import { IObsInput } from 'components/obs/inputs/ObsInput';
import ModalLayout from 'components/shared/ModalLayout.vue';
import { CustomizationService } from 'services/customization';
import { $t } from 'services/i18n';
import { WindowsService } from 'services/windows';
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'AutoCompactConfirmDialog',

  components: { ModalLayout, BoolInput },

  computed: {
    doNotShowAgain(): IObsInput<boolean> {
      return {
        name: 'do_not_show_again',
        description: $t('settings.autoCompact.doNotShowAgain'),
        value: CustomizationService.instance.showOptimizationDialogForNiconico === false,
      };
    },
  },

  methods: {
    setDoNotShowAgain(model: IObsInput<boolean>): void {
      CustomizationService.instance.setShowOptimizationDialogForNiconico(!model.value);
    },

    activate(): void {
      CustomizationService.instance.setAutoCompatMode(true);
      WindowsService.instance.closeChildWindow();
    },

    skip(): void {
      if (this.doNotShowAgain.value) {
        CustomizationService.instance.setShowAutoCompactDialog(false);
      }
      WindowsService.instance.closeChildWindow();
    },
  },
});
