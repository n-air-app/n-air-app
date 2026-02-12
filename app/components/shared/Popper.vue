<template>
  <span>
    <transition>
      <span v-show="showPopper">
        <slot />
      </span>
    </transition>
    <slot name="reference" />
  </span>
</template>

<script lang="ts" src="./Popper.vue.ts"></script>

<style lang="less">
@import url('../../styles/index');

// Popperの共通スタイル（グローバル）
// 利用側: <popper><div class="popper">コンテンツ</div><button slot="reference">...</button></popper>
// 各コンポーネントのscoped stylesで .popper { width: XXpx; } のように個別スタイル指定可能
.popper {
  .shadow();

  position: fixed;
  z-index: @z-index-popper;
  max-width: 300px;
  padding: 0;
  background-color: var(--color-popper-bg-light);
  border: 1px solid var(--color-border-light);
  border-radius: 4px;

  // ライブラリ側が生成する矢印要素を非表示
  .popper__arrow {
    display: none;
  }

  // メニューリスト
  .popup-menu-list {
    padding: 8px 0;
    margin: 0;
    list-style: none;

    &:not(:first-child) {
      border-top: 1px solid var(--color-border-light);
    }
  }

  // メニューヘッダー
  .popup-menu-head {
    width: 100%;
    padding: 16px;
    font-size: @font-size4;
    font-weight: @font-weight-bold;
    color: var(--color-text-light);
    text-align: left;
    overflow-wrap: break-word;
  }

  // メニュー項目
  .popup-menu-item {
    > * {
      width: 100%;
      padding: 0 16px;
      font-size: @font-size4;
      line-height: 32px;
    }

    > span {
      display: block;
      cursor: pointer;
    }

    a,
    button {
      &.text--red {
        color: var(--color-red-light);

        &:not(:disabled):hover {
          color: var(--color-red-light);
        }
      }
    }

    a,
    button,
    > span {
      &:not(:disabled):hover {
        color: var(--color-text-light);
        background-color: var(--color-bg-active);
      }
    }

    i {
      margin-right: 16px;
    }
  }
}
</style>
