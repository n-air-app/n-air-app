<template>
  <div
    class="dropdown"
    :class="{ 'dropdown--disabled': disabled, 'dropdown--active': isOpen }"
    :data-value="value != null ? getOptionKey(value) : ''"
    :data-selected-option-label="getOptionLabel(selectedOption)"
    @click="openDropdown"
    @focusout="onFocusout"
    v-click-outside="closeDropdown"
  >
    <div class="dropdown__arrow"></div>
    <div class="dropdown__value">
      <div v-if="selectedOption" class="dropdown__single">
        <slot name="singleLabel" :option="selectedOption">
          {{ getOptionLabel(selectedOption) }}
        </slot>
      </div>
      <span v-else class="dropdown__placeholder">{{ placeholder }}</span>
      <input
        ref="dropdownInputEl"
        class="dropdown__input"
        type="text"
        readonly
        :placeholder="isOpen ? '' : placeholder"
        @focus="openDropdown"
        @keydown="onKeydown"
      />
    </div>
    <div v-if="isOpen" class="dropdown__content-wrapper" @mousedown.prevent>
      <div class="dropdown__menu" ref="menuEl">
        <div v-if="searchable" class="dropdown__search" @click.stop>
          <input
            ref="searchInputEl"
            type="text"
            class="dropdown__search-input"
            :value="searchQuery"
            @input="onSearchInput"
            @keydown="onKeydown"
          />
        </div>
        <div v-if="loading" class="dropdown__loading">Loading...</div>
        <div
          v-for="(option, index) in filteredOptions"
          :key="getOptionKey(option)"
          class="dropdown__item"
          :data-option-value="getOptionKey(option)"
          :data-option-label="getOptionLabel(option)"
        >
          <span
            class="dropdown__option"
            :class="{
              'dropdown__option--selected': isSelected(option),
              'dropdown__option--highlighted': highlightedIndex === index,
            }"
            @click.stop="selectOption(option)"
          >
            <slot name="option" :option="option">
              {{ getOptionLabel(option) }}
            </slot>
          </span>
        </div>
        <div
          v-if="filteredOptions.length === 0 && !loading"
          class="dropdown__option dropdown__option--disabled"
        >
          <slot name="noResult">No results found</slot>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" src="./Dropdown.vue.ts"></script>

<style lang="less">
@import url("../../styles/index");
@import url("../../styles/custom-icons");

/* ========================================
 * Base Container & Variants
 * ======================================== */
.dropdown {
  // カラー変数（variant毎に上書き可能）
  --color-border: var(--color-border-light);
  --color-border-hover: var(--color-border-accent);
  --color-bg: var(--color-input-bg);

  position: relative;
  min-height: @item-generic-size;
  cursor: pointer;
  outline: none;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  .radius();
  .transition();

  &:not(.dropdown--disabled):hover,
  &:not(.dropdown--disabled):focus-within,
  &:not(.dropdown--disabled).dropdown--active {
    border-color: var(--color-border-hover);
  }

  // Variant: デフォルト（背景透明）
  &[data-variant="default"] {
    --color-border: var(--color-border-emphasis-low);
    --color-bg: transparent;
  }

  // Variant: 塗りつぶし
  &[data-variant="filled"] {
    --color-border: transparent;
    --color-bg: var(--color-surface-secondary);
  }
}

/* ========================================
 * States
 * ======================================== */
.dropdown--disabled {
  cursor: not-allowed;
  opacity: var(--opacity-disabled);

  .dropdown__input {
    cursor: not-allowed;
  }
}

/* ========================================
 * Arrow Icon
 * ======================================== */
.dropdown__arrow::before {
  position: absolute;
  top: 0;
  right: 12px;
  font-family: n-air;
  font-size: @font-size1;
  line-height: @item-generic-size;
  pointer-events: none;
  content: @n-air--codepoint--drop-down-arrow;
}

/* ========================================
 * Text Elements (Input, Label, Placeholder)
 * ======================================== */
// 共通スタイル
.dropdown__input,
.dropdown__single,
.dropdown__placeholder {
  padding: 0 32px 0 8px;
  font-size: @font-size4;
  line-height: 32px;
}

// Input（外部スタイルの上書きのため!important使用）
.dropdown__input {
  position: static !important;
  width: 100% !important;
  color: var(--color-text);
  outline: none !important;
  background-color: transparent !important;
  border: none !important;

  // placeholder初期状態は非表示
  &::placeholder {
    color: transparent !important;
  }
}

// ドロップダウン展開時 or 値が空の時のみplaceholder表示
.dropdown--active .dropdown__input::placeholder,
.dropdown__value:has(.dropdown__single:empty) .dropdown__input::placeholder {
  color: var(--color-text-dark) !important;
}

// 選択値ラベル & Placeholder（絶対配置）
.dropdown__single,
.dropdown__placeholder {
  position: absolute;
  top: 0;
  left: 0;
  height: @item-generic-size;
  overflow: hidden;
}

.dropdown__single {
  color: var(--color-text);
}

.dropdown__placeholder {
  color: var(--color-text-dark);
  cursor: pointer;
}

/* ========================================
 * Dropdown Menu
 * ======================================== */
.dropdown__menu {
  .shadow();

  position: absolute;
  top: 40px;
  z-index: @z-index-expand-content;
  width: 100%;
  max-height: 264px;
  overflow-y: auto;
  background-color: var(--color-popper-bg-light);
  border-radius: 4px;
}

.dropdown__loading {
  padding: 12px;
  color: var(--color-text-dark);
  text-align: center;
}

/* ========================================
 * Options
 * ======================================== */
.dropdown__item {
  font-size: @font-size4;
  white-space: nowrap;
}

.dropdown__option {
  display: block;
  height: @item-generic-size;
  padding: 0 8px;
  line-height: @item-generic-size;
  cursor: pointer;
  .transition();

  // Hover（選択中・無効以外）
  &:hover:not(.dropdown__option--disabled):not(.dropdown__option--selected) {
    color: var(--color-text-light);
    background: var(--color-bg-active);
  }

  // 選択中
  &--selected {
    font-weight: @font-weight-bold;
    color: var(--color-black);
    background: var(--color-primary);
  }

  // キーボードハイライト
  &--highlighted:not(.dropdown__option--selected) {
    color: var(--color-text-light);
    background: var(--color-bg-active);
  }

  // 無効
  &--disabled {
    cursor: not-allowed;
    opacity: var(--opacity-disabled);
  }

  // カスタム入力候補
  &--custom {
    font-style: italic;
    color: var(--color-text-dark);
  }
}

/* ========================================
 * Search Input
 * ======================================== */
.dropdown__search {
  padding: 4px;
  border-bottom: 1px solid var(--color-border-light);

  &-input {
    width: 100% !important;
    height: 24px !important;
    padding: 0 8px !important;
    margin-bottom: 0 !important;
    font-size: @font-size4;
    line-height: 24px;
    color: var(--color-text);
    cursor: text;
    background: var(--color-bg-secondary) !important;
    border: 1px solid var(--color-border-light) !important;
    border-radius: 2px;
  }
}
</style>
