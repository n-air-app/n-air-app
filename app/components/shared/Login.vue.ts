import * as remote from '@electron/remote';
import HelpTip from 'components/shared/HelpTip.vue';
import { CompactModeService } from 'services/compact-mode';
import { DismissablesService, EDismissable } from 'services/dismissables';
import { $t } from 'services/i18n';
import { UserService } from 'services/user';
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'Login',

  components: { HelpTip },

  mounted() {
    if (this.loggedIn) {
      if (!DismissablesService.instance().shouldShow(EDismissable.LoginHelpTip)) {
        DismissablesService.instance().reset(EDismissable.LoginHelpTip);
      }
    }
  },

  computed: {
    loggedIn(): boolean {
      return UserService.instance().isLoggedIn();
    },

    username() {
      return UserService.instance().username;
    },

    userIcon() {
      return UserService.instance().userIcon;
    },

    userId() {
      return UserService.instance().platformId;
    },

    userPageURL() {
      return UserService.instance().platformUserPageURL;
    },

    isCompactMode(): boolean {
      return CompactModeService.instance().isCompactMode;
    },

    loginHelpTipDismissable() {
      return EDismissable.LoginHelpTip;
    },
  },

  methods: {
    logout() {
      if (confirm($t('common.logoutConfirmMessage'))) {
        UserService.instance().logOut();
      }
    },

    login() {
      UserService.instance().showLogin();
    },

    openUserPage() {
      remote.shell.openExternal(this.userPageURL ?? '');
    },
  },
});
