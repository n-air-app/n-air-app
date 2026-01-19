<template>
  <div class="table-of-contents">
    <div
      v-for="section in sections"
      :key="section.id"
      class="toc-item"
      :class="{
        'toc-item--level1': section.level === 1,
        'toc-item--level2': section.level === 2
      }"
      @click="$emit('navigate', section.id)"
    >
      {{ section.title }}
    </div>
  </div>
</template>

<script lang="ts" src="./TableOfContents.vue.ts"></script>

<style lang="less" scoped>
@import url('../../styles/index');

.table-of-contents {
  display: flex;
  flex-direction: column;
}

.toc-item {
  display: flex;
  align-items: center;
  min-height: 32px;
  padding-right: 16px;
  padding-top: 4px;
  padding-bottom: 4px;
  font-size: @font-size3;
  color: var(--color-text-light);
  cursor: pointer;
  list-style: none;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  &.toc-item--level1 {
    padding-left: 48px; // 16px (親のpadding) + 32px (インデント)
  }

  &.toc-item--level2 {
    padding-left: 64px; // さらに16px追加でネスト
  }

  &.toc-item--active {
    color: var(--color-text-active);
    border-left: 2px solid var(--color-text-active);
  }

  &:not(.toc-item--active):hover {
    color: var(--color-text);
  }
}
</style>
