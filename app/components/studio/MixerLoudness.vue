<template>
  <div class="mixer-loudness" :class="`level-${level}`" v-tooltip.bottom="tooltip" @contextmenu.stop="showMenu">
    <div class="loudness-title">{{ $t('audio.loudness') }}</div>
    <div v-if="status === 'unavailable'" class="value unavailable">{{ $t('audio.loudnessUnavailable') }}</div>
    <template v-else>
      <div class="value">
        <span class="number">{{ valueText }}</span>
        <span class="unit">LUFS</span>
      </div>
      <div class="message">{{ message }}</div>
    </template>
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
  // 見ながら各ソースの音量を調整できるよう、ミキサーをスクロールしても上に残す。
  // ミキサーは縦が狭いので 1 行に収める
  position: sticky;
  top: 0;
  z-index: 1;
  display: flex;
  align-items: center;
  height: 32px;
  padding: 0 32px 0 12px;
  font-size: @font-size2;
  color: var(--color-text);
  white-space: nowrap;
  background: var(--color-bg-tertiary);
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

  // 見出しと値は常に表示し、幅が足りないときは文言を省略する
  .loudness-title {
    flex-shrink: 0;
    margin-right: 8px;
  }

  .value {
    flex-shrink: 0;

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
    flex: 1 1 auto;
    min-width: 0;
    margin-left: 8px;
    overflow: hidden;
    text-overflow: ellipsis;
    text-align: right;
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
