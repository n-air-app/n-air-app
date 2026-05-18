<template>
  <ul class="nav-menu" :class="{ 'nav-menu--child': isChild }">
    <slot></slot>
  </ul>
</template>

<script lang="ts" src="./NavMenu.vue.ts"></script>

<style lang="less" scoped>
@import url('../../styles/index');

.nav-menu:not(.nav-menu--child) {
  display: flex;
  flex: 0 0 232px;
  flex-direction: column;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-sm) var(--spacing-sm) var(--spacing-sm);
  margin: 0;

  i {
    font-size: var(--font-size-sm);
  }
}
</style>

