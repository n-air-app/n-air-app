<template>
  <div class="slider-container">
    <div class="slider" :class="{ 'slider-disabled': disabled }">
      <input
        type="range"
        class="slider-input-range"
        :value="currentIndex"
        :min="actualMin"
        :max="actualMax"
        :step="actualInterval"
        :disabled="disabled"
        :style="{ '--slider-percent': sliderPercent + '%' }"
        @input="updateValue(parseFloat($event.target.value))"
        ref="slider"
      />
      <div
        v-if="tooltip === 'always' || (tooltip === 'hover' && showTooltip)"
        class="slider-tooltip"
        :style="tooltipStyle"
      >
        {{ formatter(value) }}
      </div>
    </div>
    <input
      v-if="valueBox && !usePercentages"
      class="slider-value-input"
      type="number"
      :value="value"
      :disabled="disabled"
      :min="min"
      :max="max"
      :step="interval"
      @change="updateValue(parseFloat($event.target.value))"
      @keydown="handleKeydown"
    />
  </div>
</template>

<script lang="ts" src="./Slider.vue.ts"></script>

<style lang="less">
@import url('../../styles/index');

// コンテナ - スライダーと値入力欄を横並びに配置
.slider-container {
  display: flex;
  align-items: center;
  width: 100%;
}

// 値入力欄
.slider-value-input {
  width: auto;
  min-width: 60px;
  margin-left: 10px;

  &:disabled {
    cursor: not-allowed;
    border-color: var(--color-border-light);
    opacity: var(--opacity-disabled);
  }

  &:disabled:hover,
  &:disabled:focus {
    border-color: var(--color-border-light);
  }
}

// スライダー本体
.slider {
  position: relative;
  display: flex;
  flex-grow: 1;
  align-items: center;
  height: auto;
  padding: 8px 0;
  margin: 0;
  background: transparent;

  // 無効状態
  &.slider-disabled {
    .slider-input-range {
      cursor: not-allowed;
    }

    .slider-tooltip {
      display: none;
    }
  }
}

// range input要素のスタイリング
.slider-input-range {
  width: 100%;
  height: 4px;
  appearance: none;
  cursor: pointer;
  outline: none;
  background: var(--color-border-light);
  border-radius: 2px;

  // つまみ部分（中央にドット付き）
  &::-webkit-slider-thumb {
    width: 15px;
    height: 15px;
    margin-top: -5.5px;
    appearance: none;
    cursor: pointer;
    background: radial-gradient(
      circle at center,
      var(--color-text-dark) 0,
      var(--color-text-dark) 2.5px,
      var(--color-text) 2.5px,
      var(--color-text) 100%
    );
    border-radius: 50%;
  }

  // トラック部分（進行状況を表示：左側は白、右側がグレー）
  &::-webkit-slider-runnable-track {
    width: 100%;
    height: 4px;
    background: linear-gradient(
      to right,
      var(--color-text-light) 0%,
      var(--color-text-light) var(--slider-percent, 0%),
      var(--color-border-light) var(--slider-percent, 0%),
      var(--color-border-light) 100%
    );
    border-radius: 2px;
  }

  // 無効状態
  &:disabled {
    cursor: not-allowed;
    opacity: 0.26;
  }
}

// ツールチップ（バーの上に表示）
.slider-tooltip {
  position: absolute;
  bottom: 100%;
  padding: 4px 8px;
  margin-bottom: 0;
  font-size: @font-size4;
  color: var(--color-tooltip-text);
  white-space: nowrap;
  pointer-events: none;
  background-color: var(--color-tooltip-bg);
  border: 1px solid var(--color-tooltip-border);
  border-radius: 4px;
  transform: translateX(-50%);
  .shadow();
}
</style>
