import ModalLayout from 'components/ModalLayout.vue';
import { Subscription } from 'rxjs';
import { Inject } from 'services/core';
import { ChatMessage } from 'services/nicolive-program/ChatMessage';
import { ChatComponentType } from 'services/nicolive-program/ChatMessage/ChatComponentType';
import { KonomiTag, NicoliveClient } from 'services/nicolive-program/NicoliveClient';
import { WrappedChat, WrappedChatWithComponent } from 'services/nicolive-program/WrappedChat';
import { KonomiTagsService } from 'services/nicolive-program/konomi-tags';
import { NicoliveCommentViewerService } from 'services/nicolive-program/nicolive-comment-viewer';
import { NicoliveProgramService } from 'services/nicolive-program/nicolive-program';
import { getDisplayName } from 'services/nicolive-program/ChatMessage/getDisplayName';
import { NicoliveModeratorsService } from 'services/nicolive-program/nicolive-moderators';
import { NicoliveCommentFilterService } from 'services/nicolive-program/nicolive-comment-filter';
import { WindowsService } from 'services/windows';
import { HostsService } from 'services/hosts';
import Vue from 'vue';
import { Component } from 'vue-property-decorator';
import CommonComment from '../nicolive-area/comment/CommonComment.vue';
import EmotionComment from '../nicolive-area/comment/EmotionComment.vue';
import GiftComment from '../nicolive-area/comment/GiftComment.vue';
import NicoadComment from '../nicolive-area/comment/NicoadComment.vue';
import SystemMessage from '../nicolive-area/comment/SystemMessage.vue';
import electron from 'electron';
import {
  NicoliveFailure,
  openErrorDialogFromFailure,
} from 'services/nicolive-program/NicoliveFailure';
import Popper from 'vue-popperjs';

const componentMap: { [type in ChatComponentType]: Vue.Component } = {
  common: CommonComment,
  nicoad: NicoadComment,
  gift: GiftComment,
  emotion: EmotionComment,
  system: SystemMessage,
};

@Component({
  components: {
    ModalLayout,
    CommonComment,
    NicoadComment,
    GiftComment,
    EmotionComment,
    SystemMessage,
    Popper,
  },
})
export default class UserInfo extends Vue {
  @Inject() private nicoliveCommentViewerService: NicoliveCommentViewerService;
  @Inject() private nicoliveProgramService: NicoliveProgramService;
  @Inject() private windowsService: WindowsService;
  @Inject() private konomiTagsService: KonomiTagsService;
  @Inject() private nicoliveModeratorsService: NicoliveModeratorsService;
  @Inject() private nicoliveCommentFilterService: NicoliveCommentFilterService;
  @Inject() private hostsService: HostsService;

  private konomiTagsSubscription: Subscription;
  private myKonomiTags: KonomiTag[] = [];
  private rawKonomiTags: KonomiTag[] = [];

  private moderatorSubscription: Subscription;
  private isBlockedSubscription: Subscription;

  private cleanup: () => void = undefined;
  isLatestVisible = true;
  showPopupMenu = false;

  isBlockedUser = false;
  isFollowing = false;
  isModerator = false;

  moderatorTooltip = 'モデレーター';
  otherMenuTooltip = 'その他メニュー';

  mounted() {
    this.myKonomiTags = [];
    this.rawKonomiTags = [];
    this.isFollowing = false;

    const sentinelEl = this.$refs.sentinel as HTMLElement;
    const ioCallback: IntersectionObserverCallback = entries => {
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

    this.konomiTagsSubscription = this.konomiTagsService.stateChange.subscribe({
      next: state => {
        this.myKonomiTags = state.loggedIn ? state.loggedIn.konomiTags : [];
        this.updateKonomiTags();
      },
    });
    // ユーザー情報ウィンドウを開く度に自分の好みタグも更新する(自分の好みタグが変わっている可能性があるため)
    this.konomiTagsService.fetch();

    this.nicoliveProgramService.client.fetchKonomiTags(this.userId).then(tags => {
      this.rawKonomiTags = tags;
      this.updateKonomiTags();
    });

    this.nicoliveProgramService.client.fetchUserFollow(this.userId).then(following => {
      this.isFollowing = following;
    });

    this.isModerator = this.nicoliveModeratorsService.isModerator(this.userId);
    this.moderatorSubscription = this.nicoliveModeratorsService.stateChange.subscribe({
      next: state => {
        const isModerator = state.moderatorsCache.includes(this.userId);
        this.isModerator = isModerator;
      },
    });

    const isBlocked = (filters: { type: string; body: string }[]) =>
      filters.some(filter => filter.type === 'user' && filter.body === this.userId);

    this.isBlockedUser = isBlocked(this.nicoliveCommentFilterService.state.filters);
    this.isBlockedSubscription = this.nicoliveCommentFilterService.stateChange.subscribe({
      next: state => {
        this.isBlockedUser = isBlocked(state.filters);
      },
    });
  }

  updated() {
    if (this.isLatestVisible) {
      this.scrollToLatest();
    }
  }

  beforeDestroy() {
    this.konomiTagsSubscription.unsubscribe();
    this.moderatorSubscription.unsubscribe();
    this.isBlockedSubscription.unsubscribe();

    if (this.cleanup) {
      this.cleanup();
      this.cleanup = undefined;
    }
  }

  userIconURL = NicoliveClient.getUserIconURL(this.userId, `${Date.now()}`);
  defaultUserIconURL = NicoliveClient.defaultUserIconURL;

  get userName() {
    return this.windowsService.getChildWindowQueryParams().userName;
  }

  get userId() {
    return this.windowsService.getChildWindowQueryParams().userId;
  }

  get isPremium() {
    return this.windowsService.getChildWindowQueryParams().isPremium;
  }

  followUser(): void {
    this.nicoliveProgramService.client.followUser(this.userId).then(() => {
      this.isFollowing = true;
    });
  }

  unFollowUser(): void {
    this.nicoliveProgramService.client.unFollowUser(this.userId).then(() => {
      this.isFollowing = false;
    });
  }

  async blockUser() {
    await this.nicoliveCommentFilterService
      .addFilter({
        type: 'user',
        body: this.userId,
      })
      .catch(e => {
        if (e instanceof NicoliveFailure) {
          openErrorDialogFromFailure(e);
        }
      });
  }
  async unBlockUser() {
    const filterRecord = this.nicoliveCommentFilterService.state.filters.find(
      filter => filter.type === 'user' && filter.body === this.userId,
    );
    if (!filterRecord) {
      console.warn('unBlockUser: block user filter not found', this.userId);
      return;
    }

    await this.nicoliveCommentFilterService.deleteFilters([filterRecord.id]).catch(e => {
      if (e instanceof NicoliveFailure) {
        openErrorDialogFromFailure(e);
      }
    });
  }

  async addModerator() {
    return this.nicoliveModeratorsService.addModeratorWithConfirm({
      userId: this.userId,
      userName: this.userName,
    });
  }

  async removeModerator() {
    return this.nicoliveModeratorsService.removeModeratorWithConfirm({
      userId: this.userId,
      userName: this.userName,
    });
  }

  konomiTags: { name: string; common: boolean }[] = [];

  /**
   * this.konomiTags に自分の好みタグと共通のものを先頭に括り出しcommon: trueにして、残りを common: falseで連結してセットする
   */
  private updateKonomiTags() {
    const [same, other] = this.rawKonomiTags.reduce(
      (acc, tag) => {
        if (this.myKonomiTags.some(myTag => myTag.tag_id.value === tag.tag_id.value)) {
          acc[0].push(tag.name);
        } else {
          acc[1].push(tag.name);
        }
        return acc;
      },
      [[], []] as [string[], string[]],
    );

    this.konomiTags = [
      ...same.map(name => ({ name, common: true })),
      ...other.map(name => ({ name, common: false })),
    ];
  }

  componentMap = componentMap;

  get comments(): WrappedChatWithComponent[] {
    const comments = this.nicoliveCommentViewerService.items.filter(item => {
      return item.value.user_id === this.userId;
    });
    return comments;
  }

  scrollToLatest() {
    const scrollEl = this.$refs.scroll as HTMLElement;
    scrollEl.scrollTop = scrollEl.scrollHeight;
  }

  getDisplayName(chat: WrappedChat): string {
    return getDisplayName(chat);
  }

  // getterにして関数を返さないと全コメントに対してrerenderが走る
  get getFormattedLiveTime() {
    return (chat: ChatMessage): string => {
      const { startTime } = this.nicoliveProgramService.state;
      const diffTime = (chat.date ?? 0) - startTime;
      return NicoliveProgramService.format(diffTime);
    };
  }

  openUserPage() {
    electron.remote.shell.openExternal(this.hostsService.getUserPageURL(this.userId));
  }
  copyUserId() {
    electron.remote.clipboard.writeText(this.userId);
  }

  currentTab = 'konomi';

  changeTab(tab: string) {
    this.currentTab = tab;
  }
}
