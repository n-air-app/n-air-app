<template>
  <div class="mixer-loudness" :class="`level-${level}`" v-tooltip.bottom="tooltip" @contextmenu.stop="showMenu">
    <div class="loudness-title">{{ $t('audio.loudness') }}</div>
    <template v-if="status === 'unavailable'">
      <div class="value unavailable">{{ $t('audio.loudnessUnavailable') }}</div>
    </template>
    <template v-else>
      <div class="value">
        <span class="number">{{ valueText }}</span>
        <span class="unit">LUFS</span>
      </div>
    </template>
    <div class="message">
      <template v-if="status !== 'unavailable'">
        <span class="message-text">{{ message }}</span>
        <button v-if="canAdjust" class="adjust-button" @click.stop="openAdjust">
          {{ $t('audio.loudnessAdjust.button') }}
        </button>
      </template>
    </div>
    <button
      type="button"
      class="menu-button"
      :aria-label="$t('audio.loudnessMenu')"
      aria-haspopup="menu"
      v-tooltip.bottom="$t('audio.loudnessMenu')"
      @click.stop="showMenu"
    >
      <i class="icon-ellipsis-horizontal" />
    </button>
  </div>
</template>

<script lang="ts" src="./MixerLoudness.vue.ts"></script>

<style lang="less" scoped>
@import url('../../styles/index');

.mixer-loudness {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  padding: 8px 36px 8px 12px;
  font-size: @font-size2;
  color: var(--color-text);
  border-bottom: 1px solid var(--color-border-emphasis-low);

  .menu-button {
    position: absolute;
    top: 4px;
    right: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    padding: 0;
    font-size: @font-size2;
    color: var(--color-text-dark);
    cursor: pointer;
    background: transparent;
    border: 0;

    &:hover {
      color: var(--color-text);
    }
  }

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
    display: flex;
    flex: 0 0 100%;
    align-items: center;
    justify-content: flex-end;
    height: 24px;
    margin-top: 4px;

    .message-text {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .adjust-button {
      flex-shrink: 0;
      height: 24px;
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
