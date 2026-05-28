import * as remote from '@electron/remote';
import ModalLayout from 'components/shared/ModalLayout.vue';
import { NicoliveModeratorsService } from 'services/nicolive-program/nicolive-moderators';
import Util from 'services/utils';
import { WindowsService } from 'services/windows';
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'ModeratorConfirmDialog',

  components: { ModalLayout },

  data() {
    const windowId = Util.getCurrentUrlParams().windowId;
    const queryParams = WindowsService.instance.getWindowOptions(windowId) as any;
    return {
      user: {
        userName: queryParams.userName as string,
        userId: queryParams.userId as string,
      },
      isClosing: false,
    };
  },

  computed: {
    windowId(): string {
      return Util.getCurrentUrlParams().windowId;
    },

    queryParams() {
      return WindowsService.instance.getWindowOptions(this.windowId);
    },

    userName(): string {
      return this.user.userName;
    },

    operation(): 'add' | 'remove' {
      return (this.queryParams as any).operation as 'add' | 'remove';
    },
  },

  methods: {
    ok() {
      this.isClosing = true;
      NicoliveModeratorsService.instance.closeConfirmWindow(true);
    },

    cancel() {
      this.isClosing = true;
      NicoliveModeratorsService.instance.closeConfirmWindow(false);
    },

    openModeratorHelpPage() {
      remote.shell.openExternal('https://qa.nicovideo.jp/faq/show/22379?site_domain=default');
    },
  },
});
