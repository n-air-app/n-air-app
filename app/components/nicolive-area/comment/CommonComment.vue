<template>
  <div class="root comment-root" :class="[chat.type, { pseudoHover: commentMenuOpened }]">
    <div class="comment-wrapper" :speaking="speaking" :class="{ 'is-speaking': speaking }" @dblclick="$emit('pinned')">
      <div class="comment-number">
        <i v-if="showSpeakingIcon" :class="isSpeaking ? 'icon-play-fill' : 'icon-pause-fill'" v-tooltip.top="'コメント読み上げ: ' + speakingTooltip"></i>
        <template v-else>{{ chat.value.no }}</template>
      </div>
      <div class="comment-box">
        <div class="comment-name-box" v-if="computedName && !chat.isDeleted">
          <img
            class="comment-icon"
            :src="userIconURL"
            :alt="computedName"
            :title="computedName"
            @error.once="userIconURL = defaultUserIconURL"
            @click.stop="$emit('commentUser')"
          />
          <div class="comment-name" @click.stop="$emit('commentUser')">{{ computedName }}</div>
          <i class="icon-moderator" v-tooltip.bottom="moderatorTooltip" v-if="chat.isModerator"></i>
          <i
            class="icon-creator-support"
            v-tooltip.bottom="supporterTooltip"
            v-if="chat.isSupporter"
          ></i>
        </div>
        <div class="comment-body" :title="computedTitle">
          {{
            chat.isDeleted && !chat.filtered ? '##このコメントは削除されました##' : computedContent
          }}
        </div>
      </div>
      <button
        class="action-icon comment-misc"
        data-size="sm"
        data-variant="sabtle"
        data-radius="sm"
        data-color="secondary"
        @click="$emit('commentMenu')"
      >
        <i class="icon-kebab"></i>
      </button>
    </div>
    <div class="nameplate-hint" v-if="nameplateHint">
      <div class="nameplate-hint-header">［なふだ機能］を使ったコメントが投稿されました</div>
      <div class="nameplate-hint-body">
        ニックネームをクリックして、視聴者のことをもっとよく知ってみよう!
      </div>
      <div class="nameplate-hint-anchor">
        <a
          @click.prevent="openInDefaultBrowser($event)"
          href="https://qa.nicovideo.jp/faq/show/21148?site_domain=default"
          class="text-link"
        ><i class="icon-question"></i><span>なふだ機能とは？</span></a
        >
      </div>
    </div>
  </div>
</template>
<script lang="ts" src="./CommonComment.vue.ts"></script>

<style lang="less" scoped>
@import url('../../../styles/index');
@import url('./comment');

.comment-root {
  .common__comment-root();
}

.comment-wrapper {
  .common__comment-wrapper();

  .comment-root:not(.comment-readonly):hover &,
  .comment-root:not(.comment-readonly):hover &.pseudoHover {
    .bg-hover();
  }

  &.is-speaking {
    background-color: var(--color-highlight-low);
  }
}

.comment-number {
  .common__comment-number();

  display: flex;
  align-items: center;
  justify-content: flex-end;

  &:has(+ .comment-box .comment-name-box) {
    margin-top: 4px;
  }

  > i {
    font-size: var(--font-size-md);
    color: var(--color-object-accent-primary)
  }
}

.comment-box {
  display: flex;
  flex-direction: column;
}

.comment-name-box {
  display: none;
  pointer-events: none;

  .name & {
    display: flex;
    flex-direction: row;
    align-items: center;
    height: 24px;
    margin: 0 16px 4px;
    margin-left: 16px;
    pointer-events: all;
  }
}

.comment-icon {
  width: 24px;
  height: 24px;
  margin-right: 8px;
  cursor: pointer;
  border-radius: 9999px;
}

.comment-name {
  font-size: @font-size2;
  color: var(--color-text);
  cursor: pointer;

  &:hover,
  .comment-icon:hover + & {
    color: var(--color-text-active);
  }
}

.icon-moderator {
  margin-left: 4px;
  font-size: @font-size5;
  color: var(--color-external-nico-blue);
}

.icon-creator-support {
  margin-left: 4px;
  font-size: @font-size5;
  color: var(--color-external-nico-blue);
}

.comment-body {
  .common__comment-body();

  color: var(--color-text-light);

  .operator & {
    color: var(--color-accent);
  }

  // SpeakingType.SPEAKING (1) or SpeakingType.BLOCKING (2)
  [speaking='1'] &,
  [speaking='2'] & {
    color: var(--color-text-active);
  }
}

.comment-misc {
  .common__comment-misc();

  position: absolute;
  top: 0;
  right: 0;
  display: none;

  .comment-root:not(.comment-readonly):hover & {
    display: block;
  }
}

.nameplate-hint {
  display: flex;
  flex: 1;
  flex-direction: column;
  padding: 12px 16px;
  margin: 8px 16px;
  background-color: var(--color-bg-quinary);
  .radius();
}

.nameplate-hint-header {
  .bold();

  margin-bottom: 4px;
  font-size: @font-size3;
  color: var(--color-text-light);
}

.nameplate-hint-body {
  font-size: @font-size2;
  color: var(--color-text);
}

.nameplate-hint-anchor {
  margin-top: 8px;
  font-size: @font-size2;
}

.nameplate-hint div {
  flex: 1;
}
</style>
