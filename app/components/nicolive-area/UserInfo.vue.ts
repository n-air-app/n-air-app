import * as remote from '@electron/remote';
import CommonComment from 'components/nicolive-area/comment/CommonComment.vue';
import EmotionComment from 'components/nicolive-area/comment/EmotionComment.vue';
import GiftComment from 'components/nicolive-area/comment/GiftComment.vue';
import NicoadComment from 'components/nicolive-area/comment/NicoadComment.vue';
import SystemMessage from 'components/nicolive-area/comment/SystemMessage.vue';
import ModalLayout from 'components/shared/ModalLayout.vue';
import Popper from 'components/shared/Popper.vue';
import { Subscription } from 'rxjs';
import { HostsService } from 'services/hosts';
import { ChatMessage } from 'services/nicolive-program/ChatMessage';
import { ChatComponentType } from 'services/nicolive-program/ChatMessage/ChatComponentType';
import { KonomiTagsService } from 'services/nicolive-program/konomi-tags';
import { NicoliveCommentFilterService } from 'services/nicolive-program/nicolive-comment-filter';
import { NicoliveCommentViewerService } from 'services/nicolive-program/nicolive-comment-viewer';
import { NicoliveModeratorsService } from 'services/nicolive-program/nicolive-moderators';
import { NicoliveProgramService } from 'services/nicolive-program/nicolive-program';
import { KonomiTag, NicoliveClient } from 'services/nicolive-program/NicoliveClient';
import {
  NicoliveFailure,
  openErrorDialogFromFailure,
} from 'services/nicolive-program/NicoliveFailure';
import { isWrappedChat, WrappedChatWithComponent } from 'services/nicolive-program/WrappedChat';
import { WindowsService } from 'services/windows';
import { Component, defineComponent } from 'vue';

const componentMap: { [type in ChatComponentType]: Component } = {
  common: CommonComment,
  nicoad: NicoadComment,
  gift: GiftComment,
  emotion: EmotionComment,
  system: SystemMessage,
};

export default defineComponent({
  name: 'UserInfo',

  components: {
    ModalLayout,
    CommonComment,
    NicoadComment,
    GiftComment,
    EmotionComment,
    SystemMessage,
    Popper,
  },

  data() {
    const userId = WindowsService.instance().getChildWindowQueryParams().userId as string;
    return {
      konomiTagsSubscription: null as Subscription | null,
      myKonomiTags: [] as KonomiTag[],
      rawKonomiTags: [] as KonomiTag[],
      moderatorSubscription: null as Subscription | null,
      isBlockedSubscription: null as Subscription | null,
      cleanup: undefined as (() => void) | undefined,
      isLatestVisible: true,
      showPopupMenu: false,
      isBlockedUser: false,
      isFollowing: false,
      isModerator: false,
      isBroadcaster: false,
      moderatorTooltip: 'モデレーター',
      supporterTooltip: 'サポーター',
      otherMenuTooltip: 'その他メニュー',
      userIconURL: NicoliveClient.getUserIconURL(userId, `${Date.now()}`),
      defaultUserIconURL: NicoliveClient.defaultUserIconURL,
      konomiTags: [] as { name: string; common: boolean }[],
      componentMap,
      currentTab: 'konomi',
    };
  },

  computed: {
    userName(): string {
      return WindowsService.instance().getChildWindowQueryParams().userName as string;
    },

    userId(): string {
      return WindowsService.instance().getChildWindowQueryParams().userId as string;
    },

    isPremium(): boolean {
      return WindowsService.instance().getChildWindowQueryParams().isPremium as boolean;
    },

    isSupporter(): boolean {
      return WindowsService.instance().getChildWindowQueryParams().isSupporter as boolean;
    },

    comments(): WrappedChatWithComponent[] {
      const comments = NicoliveCommentViewerService.instance().items.filter((item) => {
        return isWrappedChat(item) && item.value.user_id === this.userId;
      }) as WrappedChatWithComponent[];
      return comments;
    },

    getFormattedLiveTime() {
      return (chat: ChatMessage): string => {
        const { startTime } = NicoliveProgramService.instance().state;
        const diffTime = (chat.date ?? 0) - startTime;
        return NicoliveProgramService.format(diffTime);
      };
    },
  },

  mounted() {
    this.myKonomiTags = [];
    this.rawKonomiTags = [];
    this.isFollowing = false;

    const sentinelEl = this.$refs.sentinel as HTMLElement;
    const ioCallback: IntersectionObserverCallback = (entries) => {
      this.isLatestVisible = entries[entries.length - 1].isIntersecting;
    };
    const ioOptions = {
      rootMargin: '0px',
      threshold: 0,
    };
    const io = new IntersectionObserver(ioCallback, ioOptions);
    io.observe(sentinelEl);
    this.cleanup = () => {
      io.unobserve(sentinelEl);
    };

    this.konomiTagsSubscription = KonomiTagsService.instance().stateChange.subscribe({
      next: (state) => {
        this.myKonomiTags = state.loggedIn ? state.loggedIn.konomiTags : [];
        this.updateKonomiTags();
      },
    });
    // ユーザー情報ウィンドウを開く度に自分の好みタグも更新する(自分の好みタグが変わっている可能性があるため)
    KonomiTagsService.instance().fetch();

    NicoliveProgramService.instance().client.fetchKonomiTags(this.userId).then((tags) => {
      this.rawKonomiTags = tags;
      this.updateKonomiTags();
    });

    NicoliveProgramService.instance().client.fetchUserFollow(this.userId).then((following) => {
      this.isFollowing = following;
    });

    this.isModerator = NicoliveModeratorsService.instance().isModerator(this.userId);
    this.moderatorSubscription = NicoliveModeratorsService.instance().stateChange.subscribe({
      next: (state) => {
        const isModerator = state.moderatorsCache.includes(this.userId);
        this.isModerator = isModerator;
      },
    });

    this.isBroadcaster = NicoliveProgramService.instance().isBroadcaster(this.userId);

    const isBlocked = (filters: { type: string; body: string }[]) =>
      filters.some((filter) => filter.type === 'user' && filter.body === this.userId);

    this.isBlockedUser = isBlocked(NicoliveCommentFilterService.instance().state.filters);
    this.isBlockedSubscription = NicoliveCommentFilterService.instance().stateChange.subscribe({
      next: (state) => {
        this.isBlockedUser = isBlocked(state.filters);
      },
    });
  },

  updated() {
    if (this.isLatestVisible) {
      this.scrollToLatest();
    }
  },

  beforeUnmount() {
    this.konomiTagsSubscription?.unsubscribe();
    this.moderatorSubscription?.unsubscribe();
    this.isBlockedSubscription?.unsubscribe();

    if (this.cleanup) {
      this.cleanup();
      this.cleanup = undefined;
    }
  },

  methods: {
    followUser(): void {
      NicoliveProgramService.instance().client.followUser(this.userId).then(() => {
        this.isFollowing = true;
      });
    },

    unFollowUser(): void {
      NicoliveProgramService.instance().client.unFollowUser(this.userId).then(() => {
        this.isFollowing = false;
      });
    },

    async blockUser() {
      await NicoliveCommentFilterService.instance()
        .addFilter({
          type: 'user',
          body: this.userId,
        })
        .catch((e: unknown) => {
          if (e instanceof NicoliveFailure) {
            openErrorDialogFromFailure(e);
          }
        });
    },

    async unBlockUser() {
      const filterRecord = NicoliveCommentFilterService.instance().findFilterByTypeAndBody('user', this.userId);
      if (!filterRecord) {
        console.warn('unBlockUser: block user filter not found', this.userId);
        return;
      }

      await NicoliveCommentFilterService.instance().deleteFilters([filterRecord.id]).catch((e: unknown) => {
        if (e instanceof NicoliveFailure) {
          openErrorDialogFromFailure(e);
        }
      });
    },

    async addModerator() {
      return NicoliveModeratorsService.instance().addModeratorWithConfirm({
        userId: this.userId,
        userName: this.userName,
      });
    },

    async removeModerator() {
      return NicoliveModeratorsService.instance().removeModeratorWithConfirm({
        userId: this.userId,
        userName: this.userName,
      });
    },

    updateKonomiTags() {
      const [same, other] = this.rawKonomiTags.reduce(
        (acc: [string[], string[]], tag: KonomiTag) => {
          if (this.myKonomiTags.some((myTag: KonomiTag) => myTag.tag_id.value === tag.tag_id.value)) {
            acc[0].push(tag.name);
          } else {
            acc[1].push(tag.name);
          }
          return acc;
        },
        [[], []] as [string[], string[]],
      );

      this.konomiTags = [
        ...same.map((name: string) => ({ name, common: true })),
        ...other.map((name: string) => ({ name, common: false })),
      ];
    },

    scrollToLatest() {
      const scrollEl = this.$refs.scroll as HTMLElement;
      scrollEl.scrollTop = scrollEl.scrollHeight;
    },

    openUserPage() {
      remote.shell.openExternal(HostsService.instance().getUserPageURL(this.userId));
    },

    copyUserId() {
      remote.clipboard.writeText(this.userId);
    },

    changeTab(tab: string) {
      this.currentTab = tab;
    },
  },
});
