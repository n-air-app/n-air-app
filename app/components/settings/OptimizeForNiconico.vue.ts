import BoolInput from 'components/obs/inputs/ObsBoolInput.vue';
import { IObsInput } from 'components/obs/inputs/ObsInput';
import ModalLayout from 'components/shared/ModalLayout.vue';
import { CustomizationService } from 'services/customization';
import { $t } from 'services/i18n';
import { SettingsService } from 'services/settings';
import { OptimizedSettings } from 'services/settings/optimizer';
import { StreamingService } from 'services/streaming';
import { WindowsService } from 'services/windows';
import { defineComponent } from 'vue';

import { CategoryIcons } from './CategoryIcons';

export default defineComponent({
  name: 'OptimizeForNiconico',
  components: {
    ModalLayout,
    BoolInput,
  },
  data() {
    return {
      settings: WindowsService.instance().getChildWindowQueryParams() as unknown as OptimizedSettings,
      icons: CategoryIcons,
      isStarting: false,
    };
  },
  computed: {
    doNotShowAgain(): IObsInput<boolean> {
      return {
        name: 'do_not_show_again',
        description: $t('streaming.doNotShowAgainOptimizationDialog'),
        value: CustomizationService.instance().showOptimizationDialogForNiconico === false,
      };
    },
    useHardwareEncoder(): IObsInput<boolean> {
      return {
        name: 'use_hardware_encoder',
        description: $t('streaming.optimizeWithHardwareEncoder'),
        value: CustomizationService.instance().optimizeWithHardwareEncoder === true,
      };
    },
    isRecording(): boolean {
      return StreamingService.instance().isRecording;
    },
  },
  methods: {
    setDoNotShowAgain(model: IObsInput<boolean>) {
      CustomizationService.instance().setShowOptimizationDialogForNiconico(!model.value);
    },
    setUseHardwareEncoder(model: IObsInput<boolean>) {
      CustomizationService.instance().setOptimizeWithHardwareEncoder(model.value ?? false);
      // close the dialog and open again to apply new optimization settings
      WindowsService.instance().closeChildWindow();
      StreamingService.instance().toggleStreamingAsync({ mustShowOptimizationDialog: true });
    },
    optimizeAndGoLive() {
      if (this.isRecording) return;
      this.isStarting = true;
      SettingsService.instance().optimizeForNiconico(this.settings.best);
      StreamingService.instance().toggleStreaming();
      WindowsService.instance().closeChildWindow();
    },
    skip() {
      this.isStarting = true;
      if (!this.isRecording && this.doNotShowAgain.value) {
        CustomizationService.instance().setOptimizeForNiconico(false);
      }
      StreamingService.instance().toggleStreaming();
      WindowsService.instance().closeChildWindow();
    },
  },
});
