<template>
  <div
    class="mixer-item"
    :class="{ muted: audioSource.muted }"
    :data-test-source-name="audioSource.source?.name"
    :data-test-source-type="audioSource.source?.type"
  >
    <div class="title-container">
      <div class="source-name">{{ audioSource.source?.name }}</div>
      <div class="db-value">
        <div v-if="audioSource.fader.deflection == 0">-Inf dB</div>
        <div v-if="audioSource.fader.deflection !== 0">
          {{ audioSource.fader.db.toFixed(1) }} dB
        </div>
      </div>
    </div>

    <MixerVolmeter :audioSource="audioSource" v-if="previewEnabled"></MixerVolmeter>

    <div class="flex">
      <Slider
        :value="audioSource.fader.deflection"
        :min="0"
        :max="1"
        :interval="0.01"
        @input="onSliderChangeHandler"
        tooltip="false"
      />
      <div class="controls">
        <template v-if="!narrowControls">
          <i
            class="icon-btn icon-speaker"
            title="click to switch off"
            v-if="!audioSource.muted"
            @click="setMuted(true)"
          >
          </i>
          <i
            class="icon-btn icon-mute"
            title="click to switch on"
            v-if="audioSource.muted"
            @click="setMuted(false)"
          >
          </i>
          <i
            class="icon-btn icon-settings"
            @click="showSourceMenu(audioSource.sourceId)"
            v-if="!isCompactMode"
          >
          </i>
        </template>
        <template v-else>
          <popper placement="bottom-end">
            <div class="popper mixer-actions-menu">
              <ul class="popup-menu-list">
                <li class="popup-menu-item">
                  <button class="source-actions-menu__item" @click="setMuted(!audioSource.muted)">
                    <i :class="audioSource.muted ? 'icon-mute' : 'icon-speaker'" />
                    {{ audioSource.muted ? $t('audio.unmute') : $t('audio.mute') }}
                  </button>
                </li>
                <li class="popup-menu-item" v-if="!isCompactMode">
                  <button class="source-actions-menu__item" @click="showSourceMenu(audioSource.sourceId)">
                    <i class="icon-settings" />
                    {{ $t('audio.advancedAudioSettings') }}
                  </button>
                </li>
              </ul>
            </div>
            <template #reference>
              <i class="icon-btn icon-ellipsis-vertical" />
            </template>
          </popper>
        </template>
      </div>
    </div>
  </div>
</template>

<script lang="ts" src="./MixerItem.vue.ts"></script>

<style lang="less" scoped>
@import url('../../styles/index');

.mixer-item {
  position: relative;
  padding: 8px 12px 0;
  color: var(--color-text);

  .source-name {
    flex: 1;
    font-size: @font-size2;
  }

  .db-value {
    width: 60px;
    font-size: @font-size2;
    text-align: right;
  }

  &.muted :deep(.slider-input-range) {
    opacity: @opacity-disabled;
  }

  .controls {
    display: flex;
    align-items: center;
    margin-left: 8px;
  }
}
</style>
