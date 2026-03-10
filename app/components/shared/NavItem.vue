<template>
  <li
    class="nav-item"
    :class="{ active: to === value, disabled: enabled == false, 'nav-item--child': isSubItem }"
    @click="onClickHandler"
  >
    <i v-if="ico" :class="ico" @click="onIconClickHandler"></i>
    <div class="nav-item__content">
      <slot></slot>
      <div v-if="expanded" class="nav-item__children">
        <slot name="children"></slot>
      </div>
    </div>
    <i v-if="expandable" :class="expanded ? 'icon-subtract' : 'icon-add'" />
    <i
      v-if="showArrow"
      class="icon-arrow-bottom-border nav-item__arrow"
      :class="{ 'is-opened': isTocOpen }"
    />
  </li>
</template>

<script lang="ts" src="./NavItem.vue.ts"></script>

<style lang="less" scoped>
@import url('../../styles/index');

.nav-item {
  display: flex;
  flex-shrink: 0; // Prevent height compression in flex container
  gap: var(--spacing-sm);
  align-items: center;
  justify-content: flex-start;
  min-height: 35px;
  padding: var(--spacing-sm);
  font-size: var(--font-size-sm);
  font-weight:bold;
  color: var(--color-object-emphasis-medium);
  cursor: pointer;
  list-style: none;
  border-radius: var(--radius-sm);

  &.nav-item--child {
    padding-left: 0;
    border-left: 0;
  }

  &.active {
    color: var(--color-object-accent-primary);
    background-color: var(--color-highlight-medium);
  }

  &:not(.active):hover {
    color: var(--color-object-emphasis-high);
    background-color: var(--color-highlight-medium);
  }

  &.disabled {
    cursor: default;
   opacity: .3;
  }

  i {
    font-size: var(--font-size-lg);
  }
}

.nav-item__arrow {
  margin-left: auto;
  font-size: var(--font-size-2xs);

  &.is-opened {
    transform: rotate(180deg);
  }
}

.nav-item__content {
  // max-width: calc(~"100% - 20px");
  width: 100%;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 14px;
  white-space: nowrap;
}

.nav-item__children {
  .margin-top();
}
</style>
