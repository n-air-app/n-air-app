<template>
  <div class="container">
    <div class="header" v-if="!isCompactMode">
      <button
        data-size="md"
        data-variant="sabtle"
        data-radius="xl"
        data-color="secondary"
        class="action-icon"
        v-tooltip.bottom="commentReloadTooltip"
        @click="refreshConnection">
        <i
          class="icon-swap-fill"
        ></i>
      </button>
      <button
        data-size="md"
        data-variant="sabtle"
        data-radius="xl"
        data-color="secondary"
        class="action-icon"
        @click="speakingEnabled = !speakingEnabled"
        v-tooltip.bottom="
          speakingEnabled ? commentSynthesizerOnTooltip : commentSynthesizerOffTooltip
        ">
        <i :class="speakingEnabled ? 'icon-sound-fill' : 'icon-sound-off-fill'"></i>
      </button>
      <div class="divider"></div>
      <button
        data-size="md"
        data-variant="sabtle"
        data-radius="xl"
        data-color="secondary"
        class="action-icon"
        v-tooltip.bottom="filterTooltip"
        @click="isFilterOpened = true">
        <i
          class="icon-comment-ng-fill"
        ></i>
      </button>
      <button
        data-size="md"
        data-variant="sabtle"
        data-radius="xl"
        data-color="secondary"
        class="action-icon"
        v-tooltip.bottom="moderatorTooltip"
        @click="openModeratorSettings">
        <i
          class="icon-moderator-menu-fill"
        ></i>
      </button>
      <button
        data-size="md"
        data-variant="sabtle"
        data-radius="xl"
        data-color="secondary"
        class="action-icon"
        v-tooltip.bottom="settingsTooltip"
        @click="openCommentSettings">
        <i
          class="icon-comment-command-fill"
        ></i>
      </button>
    </div>
    <div class="content">
      <div class="pinned" v-if="Boolean(pinnedComment)">
        <div class="comment-header"><i class="icon-pinned"></i></div>
        <component
          class="comment-readonly"
          :class="{
            row: true,
            name: getDisplayName(pinnedComment),
          }"
          :is="componentMap[pinnedComment.component]"
          :chat="pinnedItem"
          :getFormattedLiveTime="getFormattedLiveTime"
          :commentMenuOpened="false"
          :speaking="SpeakingType.NONE"
          :nameplateHint="false"
          @commentUser="showUserInfo(pinnedComment)"
        />
        <button
          class="action-icon pinned-close"
          data-size="sm"
          data-variant="sabtle"
          data-radius="sm"
          data-color="secondary"
          @click="pin(null)"
        >
          <i class="icon-close"></i>
        </button>
      </div>
      <div class="list" ref="scroll">
        <component
          :class="{
            row: true,
            name: getDisplayName(item),
            hint: hasNamePlateHint(item),
          }"
          v-for="item of items"
          :key="item.seqId"
          :is="componentMap[item.component]"
          :chat="item"
          :getFormattedLiveTime="getFormattedLiveTime"
          :commentMenuOpened="commentMenuTarget === item"
          :speaking="getSpeakingType(item)"
          :nameplateHint="hasNamePlateHint(item)"
          @pinned="pin(item)"
          @commentMenu="showCommentMenu(item)"
          @commentUser="showUserInfo(item)"
        />
        <div class="sentinel" ref="sentinel"></div>
      </div>
      <div
        class="snackbar"
        v-if="snackbar !== null"
        @mouseenter="isSnackbarHovered = true"
        @mouseleave="onSnackbarMouseLeave"
      >
        <span class="snackbar-message">{{ snackbar.message }}</span>
        <button
          v-if="snackbar.action"
          class="basic-button"
          data-size="xs"
          data-variant="sabtle"
          data-color="primary"
          data-radius="sm"
          @click="snackbar.action.onClick"
        >
          {{ snackbar.action.label }}
        </button>
        <button
          class="action-icon"
          data-size="sm"
          data-variant="sabtle"
          data-radius="sm"
          data-color="secondary"
          @click="closeSnackbar"
        >
          <i class="icon-close"></i>
        </button>
      </div>
      <div class="floating-wrapper">
        <button
          type="button"
          @click="scrollToLatest"
          class="button--circle button--tertiary"
          v-if="!isLatestVisible && items.length > 0"
        >
          <i class="icon-down-arrow"></i>
        </button>
      </div>
      <div class="created-notice" v-if="showPlaceholder">
        <p class="created-notice-large">配信準備状態です</p>
        <p class="created-notice-small">
          番組開始前の確認を行うことができます。<br />&#91; 番組開始 &#93;
          をクリックすると視聴者に公開されます。
        </p>
        <p class="created-notice-small">
          ※配信準備中は自動文字起こしによるコメントは投稿されません。
        </p>
      </div>
    </div>
    <comment-form class="comment-form" />
    <comment-filter
      class="overlay"
      @close="isFilterOpened = false"
      v-if="isFilterOpened && !isCompactMode"
    />
  </div>
</template>

<script lang="ts" src="./CommentViewer.vue.ts"></script>
<style lang="less" scoped>
@import url('../../styles/index');
@import url('./comment/comment');

.container {
  display: flex;
  flex-grow: 1;
  flex-direction: column;
  width: 100%;
  background-color: var(--color-bg-tertiary);
}

.header {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: flex-end;
  width: 100%;
  height: 48px;
  padding: 4px 16px;
  border-bottom: 1px solid var(--color-border-light);

  .divider {
    width: 1px;
    height: 14px;
    margin: 0 8px;
    background-color: var(--color-border-light);
  }
}

.content {
  position: relative;
  display: flex;
  flex-grow: 1;
  flex-direction: column;
}

.list {
  flex-grow: 1;
  height: 0; // 100%がなぜか動かなくなったので workaround (Electron 6.1.11)
  padding-top: 8px;
  overflow-x: hidden;
  overflow-y: auto;
}

.sentinel {
  height: 4px;
  margin-top: -4px;
  pointer-events: none;
}

.snackbar {
  .snackbar-styling();

  position: absolute;
  top: 8px;
  right: 0;
  left: 50%;
  width: calc(100% - 16px);
  transform: translateX(-50%);
}

.pinned {
  display: flex;
  background-color: color-mix(
    in srgb,
    var(--color-object-accent-primary) 15%,
    transparent
  ); // TODO:後で変数に差し替える

  :deep(.comment-wrapper) {
    padding: 8px 0;
  }

  :deep(.comment-number) {
    display: none;
  }

  .pinned-close {
    flex-shrink: 0;
    margin: auto 8px;
  }

  .comment-header {
    .common__comment-header();

    > i {
      color: var(--color-object-accent-primary);
    }
  }
}

.scroll-to-latest {
  .transition();

  display: flex;
  align-items: center;
  height: 32px;
  padding: 0 16px;
  font-size: @font-size2;
  line-height: 32px;
  color: var(--color-button-label);
  text-align: center;
  cursor: pointer;
  border-radius: 16px;

  > i {
    margin-right: 8px;
    font-size: @font-size1;
  }
}

.comment-form {
  flex-shrink: 0;
}

.overlay {
  position: absolute;
  z-index: @z-index-expand-content; // AreaSwitcherのheaderより大きく
  width: 100%;
  height: 100%;
  background-color: var(--color-bg-tertiary);
}

.floating-wrapper {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: @z-index-default-content;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  pointer-events: none;

  button {
    margin: 0 8px;
    pointer-events: auto;
  }
}

.created-notice {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 8px;
  pointer-events: none;
}

.created-notice-large {
  margin: 0;
  font-size: @font-size4;
  font-weight: @font-weight-bold;
  color: var(--color-text);
  text-align: center;
}

.created-notice-small {
  margin-top: 4px;
  font-size: @font-size2;
  color: var(--color-text);
  text-align: center;
}

.icon-btn {
  font-size: var(--font-size-sm);
}
</style>
