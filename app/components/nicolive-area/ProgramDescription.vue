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
}

.program-description-header {
  display: flex;
  flex-shrink: 0;
  flex-direction: row-reverse;
  align-items: center;
  width: 100%;
  height: 48px;
  padding: 4px 16px;
  background-color: @bg-secondary;
  border-bottom: 1px solid @bg-primary;
}

.program-description-body {
  flex-grow: 1;
  overflow-x: hidden;
  overflow-y: auto;
  background-color: @white;

  &::-webkit-scrollbar-track {
    background-color: transparent;
    border: none;
  }

  &::-webkit-scrollbar-thumb {
    background-color: @grey;
    border-color: @white;
  }
}

.program-description-text {
  padding: 16px;
  color: @black;
  overflow-wrap: break-word;
}
</style>
