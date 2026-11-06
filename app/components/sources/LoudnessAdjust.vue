<template>
  <modal-layout :show-controls="false" :customControls="true">
    <template #content>
      <div class="loudness-adjust">
        <template v-if="step === 'select'">
          <p class="message">{{ $t('audio.loudnessAdjust.selectMessage') }}</p>
          <p v-if="!candidates.length" class="note">{{ $t('audio.loudnessAdjust.noSource') }}</p>
          <ObsListInput v-else :value="sourceInput" @input="onSourceInput" />
          <p class="note">{{ $t('audio.loudnessAdjust.speakNote') }}</p>
          <p class="note">{{ $t('audio.loudnessAdjust.pauseNote') }}</p>
        </template>

        <template v-else-if="step === 'measuring'">
          <p class="message">{{ $t('audio.loudnessAdjust.measuring') }}</p>
          <div
            class="progress"
            role="progressbar"
            aria-valuemin="0"
            aria-valuemax="100"
            :aria-valuenow="progressPercent"
          >
            <div class="progress-bar" :style="{ width: `${progressPercent}%` }"></div>
          </div>
          <p class="note">{{ $t('audio.loudnessAdjust.remaining', { seconds: remainingSeconds }) }}</p>
          <p class="note">{{ $t('audio.loudnessAdjust.pauseNote') }}</p>
        </template>

        <template v-else-if="step === 'done'">
          <p class="message">{{ resultMessage }}</p>
          <p v-if="limited" class="note warning">{{ $t('audio.loudnessAdjust.limited') }}</p>
        </template>

        <template v-else>
          <p class="message">{{ $t('audio.loudnessAdjust.silent') }}</p>
          <p class="note">{{ $t('audio.loudnessAdjust.pauseNote') }}</p>
        </template>
      </div>
    </template>
    <template #controls>
      <template v-if="step === 'select' || step === 'silent'">
        <button class="button button--secondary" @click="close">{{ $t('common.cancel') }}</button>
        <button class="button button--primary" :disabled="!selectedId" @click="start">
          {{ $t('audio.loudnessAdjust.start') }}
        </button>
      </template>
      <template v-else-if="step === 'done'">
        <button class="button button--primary" @click="close">{{ $t('common.close') }}</button>
      </template>
    </template>
  </modal-layout>
</template>

<script lang="ts" src="./LoudnessAdjust.vue.ts"></script>

<style lang="less" scoped>
@import url('../../styles/index');

.loudness-adjust {
  color: var(--color-text);

  .message {
    margin-bottom: 16px;
    white-space: pre-line;
  }

  .note {
    margin-top: 16px;
    color: var(--color-text-dark);
    white-space: pre-line;

    &.warning {
      color: var(--color-yellow);
    }
  }

  .progress {
    height: 8px;
    overflow: hidden;
    background: var(--color-bg-secondary);
    border-radius: 4px;
  }

  .progress-bar {
    height: 100%;
    background: var(--color-primary);
    transition: width 0.2s linear;
  }
}
</style>
