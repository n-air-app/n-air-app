import * as remote from '@electron/remote';
import HelpTip from 'components/shared/HelpTip.vue';
import Login from 'components/shared/Login.vue';
import StreamingStatus from 'components/studio/StreamingStatus.vue';
import electron from 'electron';
import { CompactModeService } from 'services/compact-mode';
import { EDismissable } from 'services/dismissables';
import { EAvailableFeatures, IncrementalRolloutService } from 'services/incremental-rollout';
import { InformationsService } from 'services/informations';
import { NavigationService } from 'services/navigation';
import { SettingsService } from 'services/settings';
import { TransitionsService } from 'services/transitions';
import { UserService } from 'services/user';
import Utils from 'services/utils';
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'SideNav',

  components: {
    Login,
    HelpTip,
    StreamingStatus,
  },

  props: {
    locked: { type: Boolean },
  },

  data() {
    return {
      slideOpen: false,
      studioModeTooltip: 'Studio Mode',
    };
  },

  computed: {
    availableFeatures() {
      return EAvailableFeatures;
    },

    isCompactMode(): boolean {
      return CompactModeService.instance().isCompactMode;
    },

    compactModeTab: {
      get(): 'studio' | 'niconico' {
        return CompactModeService.instance().compactModeTab;
      },
      set(tab: 'studio' | 'niconico') {
        CompactModeService.instance().compactModeTab = tab;
      },
    },

    notifyNewComment(): boolean {
      return CompactModeService.instance().notifyNewComment;
    },

    studioModeEnabled() {
      return TransitionsService.instance().state.studioMode;
    },

    InitialHelpTipDismissable() {
      return EDismissable.InitialHelpTip;
    },

    CompactModeToggleHelpTipDismissable() {
      return EDismissable.CompactModeToggleHelpTip;
    },

    isDevMode() {
      return Utils.isDevMode();
    },

    page() {
      return NavigationService.instance().state.currentPage;
    },

    isUserLoggedIn() {
      return UserService.instance().isLoggedIn();
    },

    hasUnseenInformation() {
      return InformationsService.instance().hasUnseenItem;
    },
  },

  methods: {
    navigateStudio() {
      NavigationService.instance().navigate('Studio');
    },

    navigateOnboarding() {
      NavigationService.instance().navigate('Onboarding');
    },

    featureIsEnabled(feature: EAvailableFeatures) {
      return IncrementalRolloutService.instance().featureIsEnabled(feature);
    },

    toggleCompactMode() {
      CompactModeService.instance().toggleCompactMode();
    },

    studioMode() {
      if (TransitionsService.instance().state.studioMode) {
        TransitionsService.instance().disableStudioMode();
      } else {
        TransitionsService.instance().enableStudioMode();
      }
    },

    openSettingsWindow() {
      SettingsService.instance().showSettings();
    },

    openFeedback() {
      remote.shell.openExternal('https://form.nicovideo.jp/forms/n_air_feedback');
    },

    openHelp() {
      remote.shell.openExternal('https://qa.nicovideo.jp/faq/show/11857?site_domain=default');
    },

    openInformations() {
      InformationsService.instance().showInformations();
    },

    openDevTools() {
      electron.ipcRenderer.send('openDevTools');
    },
  },
});
