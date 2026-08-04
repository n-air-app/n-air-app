import * as remote from '@electron/remote';
import NicoliveArea from 'components/nicolive-area/NicoliveArea.vue';
import Onboarding from 'components/pages/Onboarding.vue';
import PatchNotes from 'components/pages/PatchNotes.vue';
import Studio from 'components/pages/Studio.vue';
import CustomLoader from 'components/shared/CustomLoader.vue';
import SideNav from 'components/studio/SideNav.vue';
import StudioFooter from 'components/studio/StudioFooter.vue';
import TitleBar from 'components/studio/TitleBar.vue';
import { AppService } from 'services/app';
import { CompactModeService } from 'services/compact-mode';
import { $t } from 'services/i18n';
import { NavigationService } from 'services/navigation';
import { ScenesService } from 'services/scenes';
import { UserService } from 'services/user';
import { WindowSizeService } from 'services/window-size';
import { WindowsService } from 'services/windows';
import { SentryReport } from 'util/sentry-report';
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'MainWindow',

  components: {
    TitleBar,
    SideNav,
    Studio,
    Onboarding,
    StudioFooter,
    CustomLoader,
    PatchNotes,
    NicoliveArea,
  },

  mounted() {
    WindowSizeService.instance(); // manage compact mode
  },

  computed: {
    isCompactMode(): boolean {
      return CompactModeService.instance().isCompactMode;
    },

    compactModeTab() {
      return CompactModeService.instance().compactModeTab;
    },

    title(): string {
      return WindowsService.instance().state.main.title ?? '';
    },

    page(): string {
      return NavigationService.instance().state.currentPage;
    },

    params() {
      return NavigationService.instance().state.params;
    },

    applicationLoading(): boolean {
      return AppService.instance().state.loading;
    },

    isLoggedIn(): boolean {
      return UserService.instance().isLoggedIn();
    },

    isOnboarding(): boolean {
      return NavigationService.instance().state.currentPage === 'Onboarding';
    },

    showMainMiddle(): boolean {
      if (this.isCompactMode) {
        return this.compactModeTab === 'studio';
      }
      return true;
    },

    showNicoliveArea(): boolean {
      if (this.isCompactMode) {
        return this.compactModeTab === 'niconico';
      }
      return this.page === 'Studio' && this.isLoggedIn;
    },

    /**
     * Only certain pages get locked out while the application
     * is loading.  Other pages are OK to keep using.
     */
    shouldLockContent(): boolean {
      return this.applicationLoading && NavigationService.instance().state.currentPage === 'Studio';
    },
  },

  methods: {
    async onDropHandler(event: DragEvent) {
      const files = event.dataTransfer?.files;
      if (!files || !ScenesService.instance().activeScene) {
        SentryReport.message('MainWindow', 'onDropHandler', 'Attempted to add files to a scene when no scene was active', { level: 'warning' });
        return;
      }

      const unavailableFiles: string[] = [];
      let fi = files.length;
      while (fi--) {
        const file = files.item(fi);
        if (!file) continue;
        if (!file.path) {
          unavailableFiles.push(file.name);
          continue;
        }
        try {
          ScenesService.instance().activeScene.addFile(file.path);
        } catch {
          unavailableFiles.push(file.name);
        }
      }

      if (unavailableFiles.length > 0) {
        await remote.dialog.showMessageBox(remote.getCurrentWindow(), {
          type: 'warning',
          title: $t('scenes.dropFileNotAvailableTitle'),
          message: $t('scenes.dropFileNotAvailable'),
          buttons: [$t('common.ok')],
          noLink: true,
        });
      }
    },
  },
});
