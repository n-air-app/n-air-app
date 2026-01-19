<template>
  <modal-layout bare-content :show-cancel="false" :done-handler="done">
    <div slot="content" class="settings" data-test="Settings">
      <NavMenu v-model="categoryName" class="side-menu" data-test="SideMenu">
        <template v-for="category in categoryNames">
          <NavItem
            :key="category"
            :to="category"
            :ico="icons.get(category)"
            :data-test="category"
          >
            {{ $t(`settings.${category}.name`, { fallback: category }) }}
          </NavItem>
          <TableOfContents
            v-if="category === categoryName && currentSections.length > 0"
            :key="`${category}-toc`"
            :sections="currentSections"
            @navigate="scrollToSection"
          />
        </template>
      </NavMenu>
      <div class="settings-container" ref="settingsContainer">
        <aside class="notification-root" v-if="isStreaming">
          <i class="notification-icon icon-notification" />
          <p class="notification-message">{{ $t('settings.noticeWhileStreaming') }}</p>
        </aside>

        <extra-settings v-if="categoryName === 'General'" />
        <language-settings v-if="categoryName === 'General'" />
        <hotkeys v-if="categoryName === 'Hotkeys'" />
        <api-settings v-if="categoryName === 'API'" />
        <notifications-settings v-if="categoryName === 'Notifications'" />
        <appearance-settings v-if="categoryName === 'Appearance'" />
        <experimental-settings v-if="categoryName === 'Experimental'" />
        <comment-settings v-if="categoryName === 'Comment'" />
        <speech-engine-settings v-if="categoryName === 'SpeechEngine'" />
        <sub-stream-settings v-if="categoryName === 'SubStream'" />
        <transcription-settings v-if="categoryName === 'Transcription'" />
        <GenericFormGroups
          v-if="
            !['Hotkeys', 'API', 'Notifications', 'Appearance', 'Experimental'].includes(
              categoryName,
            )
          "
          v-model="settingsData"
          :category="categoryName"
          :isLoggedIn="isLoggedIn"
          @input="save"
        />
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
  .notification-styling;

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
