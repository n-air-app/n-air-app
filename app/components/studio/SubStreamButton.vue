<template>
  <div v-if="!isCompactMode && subStreamUse" class="nav-item substream-control">
    <button
      type="button"
      class="button button--go-live substream-control-button"
      :class="{ 'button--soft-warning': isStopButton }"
      :disabled="isDisabled"
      :title="subStreamStatus"
      @click="isStopButton ? stopSubStream() : startSubStream()"
    >
      {{ $t(isStopButton ? 'settings.substream.stopButton' : 'settings.substream.startButton') }}
    </button>
  </div>
</template>

<script lang="ts" src="./SubStreamButton.vue.ts"></script>

<style lang="less" scoped>
@import url('../../styles/index');

.substream-control {
  flex-shrink: 0;
  margin-left: 16px;
}

.substream-control-button {
  height: 32px;
  padding: 0 12px;
  font-size: 12px;
  white-space: nowrap;

  &.button--soft-warning:disabled {
    background-color: var(--color-red);
  }

  &:focus-visible {
    outline: 2px solid var(--color-teal);
    outline-offset: 2px;
  }

  &:disabled {
    cursor: default;
  }
}
</style>
