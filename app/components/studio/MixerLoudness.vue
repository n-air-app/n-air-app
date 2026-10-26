<template>
  <div class="mixer-loudness" :class="`level-${level}`" v-tooltip.bottom="tooltip" @dblclick="reset">
    <div class="label">{{ $t('audio.loudness') }}</div>
    <template v-if="status === 'unavailable'">
      <div class="value unavailable">{{ $t('audio.loudnessUnavailable') }}</div>
    </template>
    <template v-else>
      <div class="value">
        <span class="number">{{ valueText }}</span>
        <span class="unit">LUFS</span>
      </div>
      <div class="diff">{{ diffText }}</div>
    </template>
  </div>
</template>

<script lang="ts" src="./MixerLoudness.vue.ts"></script>

<style lang="less" scoped>
@import url('../../styles/index');

.mixer-loudness {
  display: flex;
  align-items: baseline;
  padding: 8px 12px;
  font-size: @font-size2;
  color: var(--color-text);
  border-bottom: 1px solid var(--color-border-emphasis-low);

  .label {
    flex: 1;
  }

  .value {
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

  .diff {
    width: 48px;
    font-variant-numeric: tabular-nums;
    text-align: right;
  }

  &.level-none .number,
  &.level-low .number,
  &.level-low .diff {
    color: var(--color-text-dark);
  }

  &.level-ok .number,
  &.level-ok .diff {
    color: var(--color-accent);
  }

  &.level-high .number,
  &.level-high .diff {
    color: var(--color-yellow);
  }
}
</style>
