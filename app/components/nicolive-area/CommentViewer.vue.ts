import * as remote from '@electron/remote';
import { clipboard } from 'electron';
import { Subscription } from 'rxjs';
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
import { SettingsService } from 'services/settings';
import { SnackbarService } from 'services/snackbar';
import { SoundDetectorService } from 'services/sound-detector';
import { Menu } from 'util/menus/Menu';
import { Component, defineComponent } from 'vue';

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

const componentMap: { [type in ChatComponentType]: Component } = {
  common: CommonComment,
  nicoad: NicoadComment,
  gift: GiftComment,
  emotion: EmotionComment,
  system: SystemMessage,
};

export default defineComponent({
  name: 'CommentViewer',

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

  props: {
    showPlaceholder: { type: Boolean, default: false },
  },

  data() {
    return {
      isBlocking: false,
      blockingSubscription: null as Subscription | null,
      // テンプレートから SpeakingType enum を参照できるように公開
      SpeakingType,
      // TODO: 後で言語ファイルに移動する
      commentReloadTooltip: 'コメント再取得',
      commentSynthesizerOnTooltip: 'コメント読み上げ：クリックしてOFFにする',
      commentSynthesizerOffTooltip: 'コメント読み上げ：クリックしてONにする',
      filterTooltip: '配信用ブロック設定',
      settingsTooltip: 'コメント設定',
      moderatorTooltip: 'モデレーター管理',
      isFilterOpened: false,
      isLatestVisible: true,
      commentMenuTarget: null as WrappedMessageWithComponent | null,
      componentMap,
      cleanup: undefined as (() => void) | undefined,
      isSnackbarHovered: false,
      snackbarTimeout: null as NodeJS.Timeout | null,
    };
  },

  computed: {
    isCompactMode(): boolean {
      return CustomizationService.instance().state.compactMode;
    },

    pinnedComment(): WrappedChatWithComponent | null {
      return NicoliveCommentViewerService.instance().state.pinnedMessage;
    },

    pinnedItem(): WrappedMessage | null {
      const item = this.pinnedComment;
      return (
        item && {
          ...item,
          value: {
            ...item.value,
            content: `${getContentWithFilter(item)}  (${this.getFormattedLiveTime(item.value)})`,
            name: NicoliveProgramStateService.instance().state.nameplateEnabled
              ? item.value.name
              : undefined,
          },
        }
      );
    },

    items() {
      return NicoliveCommentViewerService.instance().itemsLocalFiltered;
    },

    speakingEnabled: {
      get(): boolean {
        return NicoliveCommentViewerService.instance().speakingEnabled;
      },
      set(e: boolean) {
        NicoliveCommentViewerService.instance().speakingEnabled = e;
      },
    },

    speakingSeqId() {
      return NicoliveCommentViewerService.instance().speakingSeqId;
    },

    blockingNextSeqId(): number | null {
      return NicoliveCommentViewerService.instance().blockingNextSeqId;
    },

    nameplateHintNo(): number | undefined {
      const nameplateHint = NicoliveProgramStateService.instance().state.nameplateHint;
      if (!nameplateHint) return undefined;
      if (nameplateHint.programID !== NicoliveProgramService.instance().state.programID) {
        return undefined;
      }
      return nameplateHint.commentNo;
    },

    getFormattedLiveTime() {
      return (chat: ChatMessage): string => {
        const { startTime } = NicoliveProgramService.instance().state;
        const diffTime = (chat.date ?? 0) - startTime;
        return NicoliveProgramService.format(diffTime);
      };
    },

    snackbar(): {
      message: string;
      action: { label: string; onClick: () => void };
      hideDelay: number;
    } | null {
      const latest = SnackbarService.instance().state.latest;
      if (latest?.position === 'niconico' && latest.action) {
        return latest as { message: string; action: { label: string; onClick: () => void }; hideDelay: number };
      }
      return null;
    },
  },

  watch: {
    snackbar() {
      this.clearSnackbarTimeout();
      if (this.snackbar) {
        this.snackbarTimeout = setTimeout(() => {
          this.snackbarTimeout = null;
          if (!this.isSnackbarHovered) {
            SnackbarService.instance().hide();
          }
        }, this.snackbar.hideDelay);
      }
    },
  },

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

    this.blockingSubscription = SoundDetectorService.instance().isBlockingObservable.subscribe({
      next: (isBlocking) => {
        this.isBlocking = isBlocking;
      },
    });

    NicoliveCommentViewerService.instance().enableSoundDetector(true);
    if (this.speakingEnabled && !SoundDetectorService.instance().isDialogShown) {
      // 放送者の声を避けたコメント読み上げ機能を案内する（初回のみ）
      SoundDetectorService.instance().markDialogShown();
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
            NicoliveCommentViewerService.instance().setSoundDetectorEnabled(true);
            SettingsService.instance().showSoundDetectorSettings();
          } else {
            NicoliveCommentViewerService.instance().setSoundDetectorEnabled(false);
          }
        });
    }
  },

  beforeUnmount() {
    if (this.cleanup) {
      this.cleanup();
      this.cleanup = undefined;
    }
    this.clearSnackbarTimeout();
    if (this.blockingSubscription) {
      this.blockingSubscription.unsubscribe();
      this.blockingSubscription = null;
    }
    NicoliveCommentViewerService.instance().enableSoundDetector(false);
  },

  updated() {
    const scrollEl = this.$refs.scroll as HTMLElement;
    if (this.isLatestVisible) {
      this.scrollToLatest();
    } else {
      const popouts = NicoliveCommentViewerService.instance().recentPopoutsLocalFiltered;
      const opt = {
        top: -popouts.length * 32, // item's height
      };
      scrollEl.scrollBy(opt);
    }
  },

  methods: {
    scrollToLatest() {
      const scrollEl = this.$refs.scroll as HTMLElement;
      scrollEl.scrollTop = scrollEl.scrollHeight;
    },

    pin(item: WrappedMessageWithComponent | null): void {
      if (!item || item.type === 'normal') {
        NicoliveCommentViewerService.instance().pinComment(null);
        if (item && item.type === 'normal') {
          this.$nextTick(() => {
            NicoliveCommentViewerService.instance().pinComment(
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
    },

    getDisplayName(item: WrappedMessage): string {
      return getDisplayName(item);
    },

    hasNamePlateHint(item: WrappedMessage): boolean {
      return (
        this.nameplateHintNo !== undefined
        && isWrappedChat(item)
        && this.nameplateHintNo === item.value.no
      );
    },

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
    },

    async refreshConnection() {
      await NicoliveCommentViewerService.instance().refreshConnection();
    },

    showCommentMenu(item: WrappedMessageWithComponent) {
      if (!(item.type === 'normal' || item.type === 'operator')) {
        return;
      }
      const { user_id: userId, content, id, name } = item.value;
      if (!userId || !content || !id) return;
      const isBroadcaster = NicoliveProgramService.instance().isBroadcaster(userId);

      const menu = new Menu();
      menu.append({
        id: 'Copy comment content',
        label: 'コメントをコピー',
        click: () => {
          clipboard.writeText(content);
        },
      });
      if (item.type === 'normal') {
        menu.append({
          id: "Copy comment owner's id",
          label: 'ユーザーIDをコピー',
          click: () => {
            clipboard.writeText(userId);
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
                NicoliveCommentViewerService.instance().undoDeleteComment(id).catch((e: unknown) => {
                  if (e instanceof NicoliveFailure) {
                    openErrorDialogFromFailure(e);
                  }
                });
                SnackbarService.instance().hide(); // スナックバーを消す
              },
            });
          } else {
            menu.append({
              id: 'Delete a comment',
              label: 'コメントを削除',
              click: () => {
                NicoliveCommentViewerService.instance()
                  .deleteComment(id)
                  .then(() => {
                    SnackbarService.instance().show({
                      position: 'niconico',
                      message: 'コメントを削除しました',
                      action: {
                        label: '取り消す',
                        onClick: () => {
                          NicoliveCommentViewerService.instance()
                            .undoDeleteComment(id)
                            .catch((e: unknown) => {
                              if (e instanceof NicoliveFailure) {
                                openErrorDialogFromFailure(e);
                              }
                            });
                        },
                      },
                    });
                  })
                  .catch((e: unknown) => {
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
              click: async () => {
                try {
                  await NicoliveCommentFilterService.instance().addFilter({
                    type: 'user',
                    body: userId,
                    messageId: `${id}`,
                    memo: content,
                  });
                  SnackbarService.instance().show({
                    position: 'niconico',
                    message: 'ユーザーを配信からブロックしました',
                    action: {
                      label: '取り消す',
                      onClick: async () => {
                        try {
                          const filterRecord = NicoliveCommentFilterService.instance().findFilterByTypeAndBody(
                            'user',
                            userId,
                          );
                          if (!filterRecord) {
                            console.warn('unBlockUser: block user filter not found', userId);
                            return;
                          }
                          await NicoliveCommentFilterService.instance().deleteFilters([filterRecord.id]);
                        } catch (e: unknown) {
                          if (e instanceof NicoliveFailure) {
                            openErrorDialogFromFailure(e);
                          }
                        }
                      },
                    },
                  });
                } catch (e: unknown) {
                  if (e instanceof NicoliveFailure) {
                    openErrorDialogFromFailure(e);
                  }
                }
              },
            });
          }
        }
        if (name /* なふだ有効ユーザー */ && !isBroadcaster) {
          if (!NicoliveModeratorsService.instance().isModerator(userId)) {
            if (!item.filtered) {
              menu.append({
                type: 'separator',
              });
              menu.append({
                id: 'Add to moderator',
                label: 'モデレーターに追加',
                click: () => {
                  NicoliveModeratorsService.instance().addModeratorWithConfirm({
                    userId,
                    userName: name,
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
                NicoliveModeratorsService.instance().removeModeratorWithConfirm({
                  userId,
                  userName: name,
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
    },

    showUserInfo(item: WrappedMessageWithComponent) {
      if (isWrappedChat(item)) {
        NicoliveCommentViewerService.instance().showUserInfo(
          item.value.user_id ?? '',
          item.value.name ?? '',
          ((item.value.premium ?? 0) & 1) !== 0,
          !!item.isSupporter,
        );
      }
    },

    openCommentSettings() {
      SettingsService.instance().showSettings('Comment');
    },

    openModeratorSettings() {
      remote.shell.openExternal(HostsService.instance().getModeratorSettingsURL());
    },

    clearSnackbarTimeout() {
      if (this.snackbarTimeout) {
        clearTimeout(this.snackbarTimeout);
        this.snackbarTimeout = null;
      }
    },

    onSnackbarMouseLeave() {
      this.isSnackbarHovered = false;
      if (this.snackbar && this.snackbarTimeout === null) {
        SnackbarService.instance().hide();
      }
    },

    openSnackbar(message: string, action?: { label: string; onClick: () => void }) {
      SnackbarService.instance().show({ position: 'niconico', message, action });
    },

    closeSnackbar() {
      SnackbarService.instance().hide();
    },

  },
});
