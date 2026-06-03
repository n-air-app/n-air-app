<template>
  <modal-layout bare-content :show-cancel="false" :done-handler="done">
    <div slot="content" class="settings" data-test="Settings">
      <NavMenu :value="categoryName" class="side-menu" data-test="SideMenu">
        <template v-for="category in categoryNames">
          <NavItem
            :key="category"
            :to="category"
            :ico="icons.get(category)"
            :data-test="category"
            :show-arrow="hasSections(category)"
            :is-toc-open="category === categoryName ? isTocOpen : false"
            @click.native.prevent="handleCategoryClick(category)"
          >
            {{ $t(`settings.${category}.name`, { fallback: category }) }}
          </NavItem>
          <TableOfContents
            v-if="category === categoryName && currentSections.length > 0 && isTocOpen"
            :key="`${category}-toc`"
            :sections="currentSections"
            :activeId="currentActiveTocId"
            @navigate="handleTocNavigate"
          />
        </template>
      </NavMenu>
      <div class="settings-container" ref="settingsContainer">
        <aside class="notification-root" v-if="isStreaming">
          <i class="notification-icon icon-notification" />
          <p class="notification-message">{{ $t('settings.noticeWhileStreaming') }}</p>
        </aside>
        <aside class="notification-root" v-if="showLoginRequiredNotice">
          <i class="notification-icon icon-notification" />
          <p class="notification-message">{{ $t('settings.noticeLoginRequired') }}</p>
        </aside>

        <language-settings v-if="categoryName === 'General'" />
        <hotkeys v-if="categoryName === 'Hotkeys'" />
        <comment-settings v-if="categoryName === 'Comment' && isLoggedIn" />
        <comment-speech-settings v-if="categoryName === 'CommentSpeech' && isLoggedIn" />
        <sub-stream-settings v-if="categoryName === 'SubStream'" />
        <transcription-settings v-if="categoryName === 'Transcription'" />
        <GenericFormGroups
          v-if="
            ![
              'Hotkeys',
              'Comment',
              'CommentSpeech',
              'SubStream',
              'Transcription',
            ].includes(categoryName)
          "
          v-model="settingsData"
          :category="categoryName"
          :isLoggedIn="isLoggedIn"
          @input="save"
        />
        <extra-settings v-if="categoryName === 'General'" />
      </div>
    </div>
  </modal-layout>
</template>

<script lang="ts" src="./Settings.vue.ts"></script>

<style lang="less" scoped>
@import url('../../styles/index');

.settings {
  display: flex;
  align-content: stretch;
  align-items: stretch;
  height: 100%;
  overflow: hidden;
}

.side-menu {
  overflow-y: auto;
}

.settings-container {
  flex-grow: 1;
  padding: 16px 8px 0 0;
  margin: 0;
  overflow-x: auto;
  overflow-y: scroll;
  scroll-behavior: smooth;
}
</style>

<style lang="less">
@import url('../../styles/index');

/*
配信中に設定ダイアログへ表示するメッセージのstyle
子コンポーネントのclassを直接参照しているのでscopedにできない
*/
.notification-root {
  .notification-styling();

  margin-bottom: var(--spacing-lg);
}

.settings-container {
  .input-container {
    flex-direction: column;

    .input-label,
    .input-wrapper {
      width: 100%;
    }

    .input-label {
      label {
        margin-bottom: 8px;
      }

      button {
        margin: 0 0 12px auto;
      }
    }
  }
}
</style>
