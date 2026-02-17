<template>
  <div class="table-of-contents">
    <div
      v-for="section in sections"
      :key="section.id"
      class="toc-item"
      :class="{
        'toc-item--level1': section.level === 1,
        'toc-item--level2': section.level === 2,
        'toc-item--active': section.id === activeId
      }"
      @click="onNavigate(section.id)"
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
  display: block;
  min-height: 35px;
  padding: var(--spacing-sm) var(--spacing-sm) var(--spacing-sm) var(--spacing-2xl);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-sm);
  color: var(--color-object-emphasis-medium);
  cursor: pointer;
  list-style: none;

  &.toc-item--level2 {
    padding-left: 64px; // さらに16px追加でネスト
  }

  &.toc-item--active {
    color: var(--color-object-emphasis-high);
    background-color: var(--color-highlight-low);
    border-radius: var(--radius-sm);
  }

  &:not(.toc-item--active):hover {
    color: var(--color-object-emphasis-high);
  }
}
</style>
