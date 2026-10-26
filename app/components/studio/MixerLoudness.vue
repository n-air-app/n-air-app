<template>
  <div class="mixer-loudness" :class="`level-${level}`" v-tooltip.bottom="tooltip" @dblclick="reset" @contextmenu.stop="showMenu">
    <div class="loudness-title">{{ $t('audio.loudness') }}</div>
    <template v-if="status === 'unavailable'">
      <div class="value unavailable">{{ $t('audio.loudnessUnavailable') }}</div>
    </template>
    <template v-else>
      <div class="value">
        <span class="number">{{ valueText }}</span>
        <span class="unit">LUFS</span>
      </div>
      <div v-if="message" class="message">
        {{ message }}
        <button v-if="canAdjust" class="adjust-button" @click.stop="openAdjust">
          {{ $t('audio.loudnessAdjust.button') }}
        </button>
      </div>
    </template>
  </div>
</template>

<script lang="ts" src="./MixerLoudness.vue.ts"></script>

<style lang="less" scoped>
@import url('../../styles/index');

.mixer-loudness {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  padding: 8px 12px;
  font-size: @font-size2;
  color: var(--color-text);
  border-bottom: 1px solid var(--color-border-emphasis-low);

  .loudness-title {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .value {
    white-space: nowrap;

    .number {
      font-variant-numeric: tabular-nums;
      .semibold();
    }

    .unit {
      margin-left: 4px;
      color: var(--color-text-dark);
    }

    &.unavailable {
      color: var(--color-text-dark);
    }
  }

  .message {
    flex: 0 0 100%;
    margin-top: 4px;
    text-align: right;

    .adjust-button {
      padding: 0 8px;
      margin-left: 8px;
      color: inherit;
      cursor: pointer;
      background: transparent;
      border: 1px solid currentcolor;
      border-radius: 4px;
    }
  }

  // 色は対処が必要なとき (小さい/大きい) だけ付ける。適正と未確定は通常の文字色のまま。
  // 赤系は避け、状態は文言でも判別できるようにしている
  &.level-none .number {
    color: var(--color-text-dark);
  }

  &.level-low .number,
  &.level-low .message,
  &.level-high .number,
  &.level-high .message {
    color: var(--color-yellow);
  }
}
</style>
