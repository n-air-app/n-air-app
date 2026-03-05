<template>
  <i
    class="icon-btn sound-detector-button"
    :class="[iconClass, { 'disabled': !isEnabled }]"
    v-tooltip.bottom="tooltip"
    @click="openSettings"
  ></i>
</template>

<script lang="ts" src="./SoundDetectorButton.vue.ts"></script>

<style lang="less" scoped>
.sound-detector-button.disabled {
  cursor: pointer; // クリック可能なことを示す
  opacity: 0.5;
}

.sound-detector-button.hidden {
  visibility: hidden;
  pointer-events: none; // クリック不可にする
}
</style>
