import * as remote from '@electron/remote';
import { clipboard } from 'electron';
import { Subscription } from 'rxjs';
import { Inject } from 'services/core/injector';
import { CustomizationService } from 'services/customization';
import { HostsService } from 'services/hosts';
import { ChatMessage } from 'services/nicolive-program/ChatMessage';
import { ChatComponentType } from 'services/nicolive-program/ChatMessage/ChatComponentType';
import { getDisplayName } from 'services/nicolive-program/ChatMessage/getDisplayName';
import { getContentWithFilter } from 'services/nicolive-program/getContentWithFilter';
import { NicoliveCommentFilterService } from 'services/nicolive-program/nicolive-comment-filter';
import { NicoliveCommentViewerService } from 'services/nicolive-program/nicolive-comment-viewer';
import { NicoliveModeratorsService } from 'services/nicolive-program/nicolive-moderators';
import { NicoliveProgramService } from 'services/nicolive-program/nicolive-program';
import {
  NicoliveFailure,
  openErrorDialogFromFailure,
} from 'services/nicolive-program/NicoliveFailure';
import { NicoliveProgramStateService } from 'services/nicolive-program/state';
import {
  isWrappedChat,
  WrappedChatWithComponent,
  WrappedMessage,
  WrappedMessageWithComponent,
} from 'services/nicolive-program/WrappedChat';
import { ISettingsServiceApi } from 'services/settings';
import { SnackbarService } from 'services/snackbar';
import { SoundDetectorService } from 'services/sound-detector';
import { Menu } from 'util/menus/Menu';
import Vue from 'vue';
import { Component, Prop, Watch } from 'vue-property-decorator';

import NAirLogo from '../../../media/images/n-air-logo.svg';

import CommonComment from './comment/CommonComment.vue';
import EmotionComment from './comment/EmotionComment.vue';
import GiftComment from './comment/GiftComment.vue';
import NicoadComment from './comment/NicoadComment.vue';
import { SpeakingType } from './comment/SpeakingType';
import SystemMessage from './comment/SystemMessage.vue';
import CommentFilter from './CommentFilter.vue';
import CommentForm from './CommentForm.vue';
import SoundDetectorButton from './SoundDetectorButton.vue';

const componentMap: { [type in ChatComponentType]: Vue.Component } = {
  common: CommonComment,
  nicoad: NicoadComment,
  gift: GiftComment,
  emotion: EmotionComment,
  system: SystemMessage,
};

@Component({
  components: {
    CommentForm,
    CommentFilter,
    SoundDetectorButton,
    CommonComment,
    NicoadComment,
    GiftComment,
    EmotionComment,
    SystemMessage,
    NAirLogo,
  },
})
export default class CommentViewer extends Vue {
  @Inject()
  private nicoliveProgramService: NicoliveProgramService;

  @Inject()
  private nicoliveProgramStateService: NicoliveProgramStateService;

  @Inject()
  private nicoliveCommentViewerService: NicoliveCommentViewerService;

  @Inject()
  private nicoliveCommentFilterService: NicoliveCommentFilterService;

  @Inject() private customizationService: CustomizationService;

  @Inject() private settingsService: ISettingsServiceApi;

  @Inject() private nicoliveModeratorsService: NicoliveModeratorsService;
  @Inject() private hostsService: HostsService;
  @Inject() private snackbarService: SnackbarService;
  @Inject() private soundDetectorService: SoundDetectorService;

  @Prop({ default: false }) showPlaceholder: boolean;

  isBlocking: boolean = false;
  private blockingSubscription: Subscription = null;

  // テンプレートから SpeakingType enum を参照できるように公開
  readonly SpeakingType = SpeakingType;

  get isCompactMode(): boolean {
    return this.customizationService.state.compactMode;
  }

  // TODO: 後で言語ファイルに移動する
  commentReloadTooltip = 'コメント再取得';
  commentSynthesizerOnTooltip = 'コメント読み上げ：クリックしてOFFにする';
  commentSynthesizerOffTooltip = 'コメント読み上げ：クリックしてONにする';
  filterTooltip = '配信用ブロック設定';
  settingsTooltip = 'コメント設定';
  moderatorTooltip = 'モデレーター管理';

  isFilterOpened = false;

  isLatestVisible = true;

  get pinnedComment(): WrappedChatWithComponent | null {
    return this.nicoliveCommentViewerService.state.pinnedMessage;
  }

  scrollToLatest() {
    const scrollEl = this.$refs.scroll as HTMLElement;
    scrollEl.scrollTop = scrollEl.scrollHeight;
  }

  pin(item: WrappedMessageWithComponent | null): void {
    if (!item || item.type === 'normal') {
      this.nicoliveCommentViewerService.pinComment(null);
      if (item && item.type === 'normal') {
        this.$nextTick(() => {
          this.nicoliveCommentViewerService.pinComment(
            item && {
              ...item,
              value: {
                ...item.value,
                name: item.value.name || item.rawName, // なふだon/offに追従できるようにnameを復元して保持する
              },
            },
          );
        });
      }
    }
  }

  get pinnedItem(): WrappedMessage | null {
    const item = this.pinnedComment;
    return (
      item && {
        ...item,
        value: {
          ...item.value,
          content: `${getContentWithFilter(item)}  (${this.getFormattedLiveTime(item.value)})`,
          name: this.nicoliveProgramStateService.state.nameplateEnabled
            ? item.value.name
            : undefined,
        },
      }
    );
  }

  getDisplayName(item: WrappedMessage): string {
    return getDisplayName(item);
  }

  hasNamePlateHint(item: WrappedMessage): boolean {
    return this.nameplateHintNo && isWrappedChat(item) && this.nameplateHintNo === item.value.no;
  }

  componentMap = componentMap;

  get items() {
    return this.nicoliveCommentViewerService.itemsLocalFiltered;
  }

  get speakingEnabled(): boolean {
    return this.nicoliveCommentViewerService.speakingEnabled;
  }
  set speakingEnabled(e: boolean) {
    this.nicoliveCommentViewerService.speakingEnabled = e;
  }

  get speakingSeqId() {
    return this.nicoliveCommentViewerService.speakingSeqId;
  }

  get blockingNextSeqId(): number | null {
    return this.nicoliveCommentViewerService.blockingNextSeqId;
  }

  getSpeakingType(item: WrappedMessageWithComponent): SpeakingType {
    if (this.speakingSeqId === item.seqId) {
      return this.isBlocking ? SpeakingType.BLOCKING : SpeakingType.SPEAKING;
    }
    // speakingSeqId が null（cancel/graceful で終了後）かつ
    // キューが disabled で、このコメントが次の待機アイテムの場合
    if (this.speakingSeqId === null && this.blockingNextSeqId === item.seqId) {
      return SpeakingType.BLOCKING;
    }
    return SpeakingType.NONE;
  }

  get nameplateHintNo(): number | undefined {
    const nameplateHint = this.nicoliveProgramStateService.state.nameplateHint;
    if (!nameplateHint) return undefined;
    if (nameplateHint.programID !== this.nicoliveProgramService.state.programID) return undefined;
    return nameplateHint.commentNo;
  }

  async refreshConnection() {
    await this.nicoliveCommentViewerService.refreshConnection();
  }

  // getterにして関数を返さないと全コメントに対してrerenderが走る
  get getFormattedLiveTime() {
    return (chat: ChatMessage): string => {
      const { startTime } = this.nicoliveProgramService.state;
      const diffTime = (chat.date ?? 0) - startTime;
      return NicoliveProgramService.format(diffTime);
    };
  }

  commentMenuTarget: WrappedMessageWithComponent | null = null;
  showCommentMenu(item: WrappedMessageWithComponent) {
    if (!(item.type === 'normal' || item.type === 'operator')) {
      return;
    }
    const isBroadcaster = this.nicoliveProgramService.isBroadcaster(item.value.user_id);

    const menu = new Menu();
    menu.append({
      id: 'Copy comment content',
      label: 'コメントをコピー',
      click: () => {
        clipboard.writeText(item.value.content);
      },
    });
    if (item.type === 'normal') {
      menu.append({
        id: "Copy comment owner's id",
        label: 'ユーザーIDをコピー',
        click: () => {
          clipboard.writeText(item.value.user_id);
        },
      });
      if (!item.filtered) {
        menu.append({
          type: 'separator',
        });
        if (item.isDeleted) {
          menu.append({
            id: 'Undo delete a comment',
            label: 'コメント削除を取り消す',
            click: () => {
              this.nicoliveCommentViewerService.undoDeleteComment(item.value.id).catch((e) => {
                if (e instanceof NicoliveFailure) {
                  openErrorDialogFromFailure(e);
                }
              });
              this.snackbarService.hide(); // スナックバーを消す
            },
          });
        } else {
          menu.append({
            id: 'Delete a comment',
            label: 'コメントを削除',
            click: () => {
              this.nicoliveCommentViewerService
                .deleteComment(item.value.id)
                .then(() => {
                  this.snackbarService.show({
                    position: 'niconico',
                    message: 'コメントを削除しました',
                    action: {
                      label: '取り消す',
                      onClick: () => {
                        this.nicoliveCommentViewerService
                          .undoDeleteComment(item.value.id)
                          .catch((e) => {
                            if (e instanceof NicoliveFailure) {
                              openErrorDialogFromFailure(e);
                            }
                          });
                      },
                    },
                  });
                })
                .catch((e) => {
                  if (e instanceof NicoliveFailure) {
                    openErrorDialogFromFailure(e);
                  }
                });
            },
          });
        }
        if (!isBroadcaster /* 自分のコメントはブロックできない */) {
          menu.append({
            type: 'separator',
          });
          menu.append({
            id: 'Ban comment owner',
            label: 'ユーザーを配信からブロック',
            click: () => {
              this.nicoliveCommentFilterService
                .addFilter({
                  type: 'user',
                  body: item.value.user_id,
                  messageId: `${item.value.id}`,
                  memo: item.value.content,
                })
                .catch((e) => {
                  if (e instanceof NicoliveFailure) {
                    openErrorDialogFromFailure(e);
                  }
                });
            },
          });
        }
      }
      if (item.value.name /* なふだ有効ユーザー */ && !isBroadcaster) {
        if (!this.nicoliveModeratorsService.isModerator(item.value.user_id)) {
          if (!item.filtered) {
            menu.append({
              type: 'separator',
            });
            menu.append({
              id: 'Add to moderator',
              label: 'モデレーターに追加',
              click: () => {
                this.nicoliveModeratorsService.addModeratorWithConfirm({
                  userId: item.value.user_id,
                  userName: item.value.name,
                });
              },
            });
          }
        } else {
          menu.append({
            type: 'separator',
          });
          menu.append({
            id: 'Remove from moderator',
            label: 'モデレーターから削除',
            click: () => {
              this.nicoliveModeratorsService.removeModeratorWithConfirm({
                userId: item.value.user_id,
                userName: item.value.name,
              });
            },
          });
        }
      }
      if (!item.isDeleted && !item.filtered && this.pinnedComment?.seqId !== item.seqId) {
        menu.append({
          type: 'separator',
        });
        menu.append({
          id: 'Pin the comment',
          label: 'コメントをピン留め',
          click: () => {
            this.pin(item);
          },
        });
      }
    }

    // コンテキストメニューが出るとホバー判定が消えるので、外観を維持するために注目している要素を保持しておく
    menu.menu.once('menu-will-show', () => {
      this.commentMenuTarget = item;
    });
    menu.menu.once('menu-will-close', () => {
      if (this.commentMenuTarget === item) {
        this.commentMenuTarget = null;
      }
    });
    menu.popup();
  }

  showUserInfo(item: WrappedMessageWithComponent) {
    if (isWrappedChat(item)) {
      this.nicoliveCommentViewerService.showUserInfo(
        item.value.user_id,
        item.value.name,
        (item.value.premium & 1) !== 0,
        item.isSupporter,
      );
    }
  }

  private cleanup: () => void = undefined;

  mounted() {
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
    this.scrollToLatest();

    this.blockingSubscription = this.soundDetectorService.isBlockingObservable.subscribe({
      next: (isBlocking) => {
        this.isBlocking = isBlocking;
      },
    });

    this.nicoliveCommentViewerService.enableSoundDetector(true);
    if (this.speakingEnabled && !this.soundDetectorService.isDialogShown) {
      // 放送者の声を避けたコメント読み上げ機能を案内する（初回のみ）
      this.soundDetectorService.markDialogShown();
      remote.dialog
        .showMessageBox(remote.getCurrentWindow(), {
          type: 'question',
          buttons: ['yes', 'no'],
          title: 'コメント読み上げ停止機能',
          message: '放送者がしゃべっているときにコメント読み上げを停止する設定をしますか?',
          defaultId: 0,
          cancelId: 1,
        })
        .then(({ response }) => {
          if (response === 0) {
            this.nicoliveCommentViewerService.setSoundDetectorEnabled(true);
            this.settingsService.showSoundDetectorSettings();
          } else {
            this.nicoliveCommentViewerService.setSoundDetectorEnabled(false);
          }
        });
    }
  }

  beforeDestroy() {
    if (this.cleanup) {
      this.cleanup();
      this.cleanup = undefined;
    }
    this.clearSnackbarTimeout();
    if (this.blockingSubscription) {
      this.blockingSubscription.unsubscribe();
      this.blockingSubscription = null;
    }
    this.nicoliveCommentViewerService.enableSoundDetector(false);
  }

  updated() {
    const scrollEl = this.$refs.scroll as HTMLElement;
    if (this.isLatestVisible) {
      this.scrollToLatest();
    } else {
      const popouts = this.nicoliveCommentViewerService.recentPopoutsLocalFiltered;
      const opt = {
        top: -popouts.length * 32, // item's height
      };
      scrollEl.scrollBy(opt);
    }
  }

  openCommentSettings() {
    this.settingsService.showSettings('Comment');
  }

  openModeratorSettings() {
    remote.shell.openExternal(this.hostsService.getModeratorSettingsURL());
  }

  get snackbar(): {
    message: string;
    action: { label: string; onClick: () => void };
    hideDelay: number;
  } | null {
    if (this.snackbarService.state.latest?.position === 'niconico') {
      return this.snackbarService.state.latest;
    }
    return null;
  }

  isSnackbarHovered = false;

  private snackbarTimeout: NodeJS.Timeout | null = null;
  clearSnackbarTimeout() {
    if (this.snackbarTimeout) {
      clearTimeout(this.snackbarTimeout);
      this.snackbarTimeout = null;
    }
  }

  @Watch('snackbar')
  onSnackbarChange() {
    this.clearSnackbarTimeout();
    if (this.snackbar) {
      this.snackbarTimeout = setTimeout(() => {
        this.snackbarTimeout = null;
        if (!this.isSnackbarHovered) {
          this.snackbarService.hide();
        }
      }, this.snackbar.hideDelay);
    }
  }

  onSnackbarMouseLeave() {
    this.isSnackbarHovered = false;
    if (this.snackbar && this.snackbarTimeout === null) {
      this.snackbarService.hide();
    }
  }

  openSnackbar(message: string, action?: { label: string; onClick: () => void }) {
    this.snackbarService.show({ position: 'niconico', message, action });
  }

  closeSnackbar() {
    this.snackbarService.hide();
  }
}
