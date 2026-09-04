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
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.patch-notes-container {
  position: absolute;
  width: 480px;
}

.patch-notes-content {
  position: relative;
}

.patch-notes-content > header {
  padding-left: 24px;
  font-size: 16px;
  color: @text-secondary;
  text-align: left;
  letter-spacing: 0.5px;
}

.patch-notes-version {
  margin: 24px 0;
  font-size: 24px;
  font-weight: 400;
  color: @text-primary;
  text-align: center;
  letter-spacing: 0.5px;
}

.patch-notes-wrap {
  width: 100%;
}

.patch-notes-list {
  box-sizing: border-box;
  width: 100%;
  max-height: 160px;
  padding: 0 48px 0 32px;
  margin-bottom: 32px;
  overflow-x: hidden;
  overflow-y: auto;
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
  width: 50%;
  margin: 0 auto;
  font-size: 20px;
}
</style>
