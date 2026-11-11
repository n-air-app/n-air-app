<template>
  <div class="patch-notes-page">
    <div class="patch-notes-container patch-notes-container--opened">
      <div class="patch-notes-content">
        <header>
          {{ $t('onboarding.updateHeader') }}
        </header>
        <p class="patch-notes-version">
          {{ notes.version }}
        </p>
        <div class="patch-notes-wrap">
          <ul class="patch-notes-list">
            <li class="patch-notes-item" v-for="(item, index) in notes.notes" :key="index">
              {{ item }}
            </li>
          </ul>
        </div>
        <button @click="done" class="patch-notes-button button button--action">
          {{ $t('onboarding.updateDone') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script lang="ts" src="./PatchNotes.vue.ts"></script>

<style lang="less" scoped>
@import url('../../styles/index');

.patch-notes-page {
  text-align: center;
}

// ページ全体に広げ、内容が少なければ中央寄せ・多ければリストだけをスクロールさせる
.patch-notes-container {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px;
}

.patch-notes-content {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 800px;
  max-height: 100%;
}

.patch-notes-content > header {
  flex-shrink: 0;
  padding-left: 24px;
  font-size: 18px;
  color: @text-secondary;
  text-align: left;
  letter-spacing: 0.5px;
}

.patch-notes-version {
  flex-shrink: 0;
  margin: 24px 0;
  font-size: 28px;
  font-weight: 400;
  color: @text-primary;
  text-align: center;
  letter-spacing: 0.5px;
}

.patch-notes-wrap {
  display: flex;
  flex: 1 1 auto;
  width: 100%;
  min-height: 0;
}

.patch-notes-list {
  box-sizing: border-box;
  width: 100%;
  padding: 0 48px 0 32px;
  margin-bottom: 32px;
  overflow-x: hidden;
  overflow-y: auto;
  font-size: 16px;
  line-height: 1.6;
  color: @text-secondary;
  text-align: left;
}

.patch-notes-list::-webkit-scrollbar {
  width: 8px;
}

.patch-notes-list::-webkit-scrollbar-track {
  background: fade(@grey, 15%);
  border-radius: 4px;
}

.patch-notes-list::-webkit-scrollbar-thumb {
  background: @text-secondary;
  border-radius: 4px;
}

.patch-notes-item {
  margin-bottom: 8px;
}

.patch-notes-button {
  flex-shrink: 0;
  width: 50%;
  max-width: 320px;
  margin: 0 auto;
  font-size: 20px;
}
</style>
