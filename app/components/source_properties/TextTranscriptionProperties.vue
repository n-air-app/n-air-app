<template>
  <div class="text-transcription-properties">
    <div v-if="!isTranscriptionEnabled" class="status-row">
      <p class="disabled">{{ $t('source-props.text_transcription.properties.disabledMessage') }}</p>
      <button class="button" @click="openSettings">
        {{ $t('source-props.text_transcription.properties.openSettings') }}
      </button>
    </div>
  </div>
</template>

<script lang="ts" src="./TextTranscriptionProperties.vue.ts"></script>

<style lang="less" scoped>
@import url('../../styles/index');

.text-transcription-properties {
  padding: 16px;

  .status-row {
    display: flex;
    gap: 12px;
    align-items: center;
  }

  p {
    flex: 1;
    margin: 0;
  }

  .disabled {
    color: @red-light;
  }
}
</style>
