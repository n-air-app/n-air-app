import * as remote from '@electron/remote';
import ObsBoolInput from 'components/obs/inputs/ObsBoolInput.vue';
import { IObsInput } from 'components/obs/inputs/ObsInput';
import TocSection from 'components/shared/TocSection.vue';
import electron from 'electron';
import { AppService } from 'services/app';
import { CustomizationService } from 'services/customization';
import { $t } from 'services/i18n';
import { OnboardingService } from 'services/onboarding';
import { EStreamingState, StreamingService } from 'services/streaming';
import { UserService } from 'services/user';
import { UuidService } from 'services/uuid';
import { WindowsService } from 'services/windows';
import { defineComponent } from 'vue';

import ClipBoardCopy from '../../../media/images/clipboard-copy.svg';

export default defineComponent({
  name: 'ExtraSettings',
  components: {
    ObsBoolInput,
    ClipBoardCopy,
    TocSection,
  },
  data() {
    return {
      cacheUploading: false,
      showCacheId: false,
    };
  },
  computed: {
    isStreaming(): boolean {
      return StreamingService.instance().state.streamingStatus !== EStreamingState.Offline;
    },
    cacheId(): string {
      return UuidService.instance().uuid;
    },
    optimizeForNiconicoModel(): IObsInput<boolean> {
      return {
        name: 'optimize_for_niconico',
        description: $t('settings.optimizeForNiconico'),
        value: CustomizationService.instance().state.optimizeForNiconico ?? false,
        enabled: !this.isStreaming,
      };
    },
    showOptimizationDialogForNiconicoModel(): IObsInput<boolean> {
      return {
        name: 'show_optimization_dialog_for_niconico',
        description: $t('settings.showOptimizationDialogForNiconico'),
        value: CustomizationService.instance().state.showOptimizationDialogForNiconico ?? false,
        enabled: !this.isStreaming,
      };
    },
    optimizeWithHardwareEncoderModel(): IObsInput<boolean> {
      return {
        name: 'optimize_with_hardware_encoder',
        description: $t('settings.optimizeWithHardwareEncoder'),
        value: CustomizationService.instance().state.optimizeWithHardwareEncoder ?? false,
        enabled: !this.isStreaming,
      };
    },
    pollingPerformanceStatisticsModel(): IObsInput<boolean> {
      return {
        name: 'polling_performance_statistics',
        description: $t('settings.pollingPerformanceStatistics'),
        value: CustomizationService.instance().pollingPerformanceStatistics ?? false,
      };
    },
    autoCompactModel(): IObsInput<boolean> {
      return {
        name: 'auto_compact',
        description: $t('settings.autoCompact.setting'),
        value: CustomizationService.instance().state.autoCompactMode ?? false,
      };
    },
    showAutoCompactDialogModel(): IObsInput<boolean> {
      return {
        name: 'show_auto_compact_confirm_dialog',
        description: $t('settings.autoCompact.showDialog'),
        value: CustomizationService.instance().state.showAutoCompactDialog ?? false,
      };
    },
    compactAlwaysOnTopModel(): IObsInput<boolean> {
      return {
        name: 'compact_mode_always_on_top',
        description: $t('settings.compactAlwaysOnTop'),
        value: CustomizationService.instance().state.compactAlwaysOnTop ?? false,
      };
    },
  },
  methods: {
    copyToClipboard(text: string) {
      electron.clipboard.writeText(text);
    },
    setOptimizeForNiconico(model: IObsInput<boolean>) {
      CustomizationService.instance().setOptimizeForNiconico(model.value ?? false);
    },
    setShowOptimizationDialogForNiconico(model: IObsInput<boolean>) {
      CustomizationService.instance().setShowOptimizationDialogForNiconico(model.value ?? false);
    },
    setOptimizeWithHardwareEncoder(model: IObsInput<boolean>) {
      CustomizationService.instance().setOptimizeWithHardwareEncoder(model.value ?? false);
    },
    setPollingPerformanceStatistics(model: IObsInput<boolean>) {
      CustomizationService.instance().setPollingPerformanceStatistics(model.value ?? false);
    },
    setAutoCompact(model: IObsInput<boolean>) {
      CustomizationService.instance().setAutoCompatMode(model.value ?? false);
    },
    setShowAutoCompactDialog(model: IObsInput<boolean>) {
      CustomizationService.instance().setShowAutoCompactDialog(model.value ?? false);
    },
    setCompactAlwaysOnTop(model: IObsInput<boolean>) {
      CustomizationService.instance().setCompactAlwaysOnTop(model.value ?? false);
    },
    showCacheDir() {
      remote.shell.openPath(remote.app.getPath('userData'));
    },
    deleteCacheDir() {
      if (confirm($t('settings.clearCacheConfirm'))) {
        AppService.instance().relaunch({ clearCacheDir: 'cache' });
      }
    },
    deleteAllCacheDir() {
      if (confirm($t('settings.clearAllCacheConfirm'))) {
        AppService.instance().relaunch({ clearCacheDir: 'all' });
      }
    },
    deleteCookies() {
      if (confirm($t('settings.deleteCookiesConfirm'))) {
        AppService.instance().relaunch({ clearCacheDir: 'cookie' });
      }
    },
    isNiconicoLoggedIn(): boolean {
      return UserService.instance().isNiconicoLoggedIn() ?? false;
    },
    goToOnboarding() {
      WindowsService.instance().closeChildWindow();
      OnboardingService.instance().start();
    },
  },
});
