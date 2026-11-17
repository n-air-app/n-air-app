<template>
  <div
    class="mixer-item"
    :class="{ muted: audioSource.muted }"
    :data-test-source-name="audioSource.source?.name"
    :data-test-source-type="audioSource.source?.type"
  >
    <div class="title-container">
      <div class="source-name">{{ audioSource.source?.name }}</div>
      <div v-if="showGain" class="gain" :class="{ attention: offTarget }">
        <button
          type="button"
          class="gain-down"
          :disabled="!canGainDown"
          :aria-label="$t('audio.gainDown')"
          v-tooltip.bottom="gainDownTooltip"
          @click.stop="gainDown"
        >
          -
        </button>
        <span class="gain-value" v-tooltip.bottom="$t('audio.gainValueTooltip', { db: gainText })">
          {{ gainText }}
        </span>
        <button
          type="button"
          class="gain-up"
          :disabled="!canGainUp"
          :aria-label="$t('audio.gainUp')"
          v-tooltip.bottom="gainUpTooltip"
          @click.stop="gainUp"
        >
          +
        </button>
      </div>
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
            :title="$t('audio.mute')"
            v-if="!audioSource.muted"
            @click="setMuted(true)"
          >
          </i>
          <i
            class="icon-btn icon-mute"
            :title="$t('audio.unmute')"
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
                  <button class="popup-menu-item__button" @click="setMuted(!audioSource.muted)">
                    <i :class="audioSource.muted ? 'icon-mute' : 'icon-speaker'" />
                    {{ audioSource.muted ? $t('audio.unmute') : $t('audio.mute') }}
                  </button>
                </li>
                <li class="popup-menu-item" v-if="!isCompactMode">
                  <button class="popup-menu-item__button" @click="showSourceMenu(audioSource.sourceId)">
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

  .title-container {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
  }

  // 幅が足りないときは、名前を削るより先にゲインや dB 値を2行目へ折り返す
  .source-name {
    flex: 1 1 5em;
    min-width: 5em;
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: @font-size2;
    white-space: nowrap;
  }

  .gain {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    height: 18px;
    margin-left: 6px;
    overflow: hidden;
    font-size: @font-size1;
    color: var(--color-text);
    white-space: nowrap;
    border: 1px solid var(--color-border-light);
    border-radius: 9px;

    // 配信音声が目標から外れているときは、ラウドネスパネルと同じ黄色で示す
    &.attention {
      color: var(--color-yellow);
      border-color: currentcolor;

      .gain-value {
        border-color: currentcolor;
      }
    }

    button {
      height: 100%;
      padding: 0 5px;
      line-height: 16px;
      color: inherit;
      cursor: pointer;
      background: transparent;
      border: 0;

      &:hover:not(:disabled) {
        background: var(--color-bg-secondary);
      }

      &:disabled {
        cursor: default;
        opacity: @opacity-disabled;
      }
    }

    .gain-value {
      min-width: 28px;
      padding: 0 3px;
      line-height: 16px;
      text-align: center;
      border-right: 1px solid var(--color-border-light);
      border-left: 1px solid var(--color-border-light);
    }
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
