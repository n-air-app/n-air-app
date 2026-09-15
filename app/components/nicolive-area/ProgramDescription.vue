<template>
  <div class="program-description">
    <div class="program-description-header"></div>
    <div @click="handleAnchorClick" class="program-description-body">
      <div v-html="programDescription" class="program-description-text"></div>
    </div>
  </div>
</template>

<script lang="ts" src="./ProgramDescription.vue.ts"></script>
<style lang="less" scoped>
@import url('../../styles/index');

.program-description {
  display: flex;
  flex-grow: 1;
  flex-direction: column;
  width: 100%;
  background-color: var(--color-bg-tertiary);
}

.program-description-header {
  display: flex;
  flex-shrink: 0;
  flex-direction: row-reverse;
  align-items: center;
  width: 100%;
  height: 48px;
  padding: 4px 16px;
  border-bottom: 1px solid var(--color-border-light);
}

.program-description-body {
  flex-grow: 1;
  overflow-x: hidden;
  overflow-y: auto;

  &::-webkit-scrollbar-track {
    background-color: transparent;
    border: none;
  }

  &::-webkit-scrollbar-thumb {
    background-color: var(--color-scroll-bar);
    border-color: var(--color-bg-tertiary);
  }
}

.program-description-text {
  padding: 16px;
  color: var(--color-text);
  overflow-wrap: break-word;
}
</style>
