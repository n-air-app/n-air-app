<template>
  <div
    class="mixer-item"
    :class="{ muted: audioSource.muted }"
    :data-test-source-name="audioSource.source?.name"
    :data-test-source-type="audioSource.source?.type"
  >
    <div class="title-container">
      <div class="source-name">{{ audioSource.source?.name }}</div>
      <div v-if="gainDb > 0 || canGainUp" class="gain" :class="{ attention: canGainUp }">
        <button
          v-if="gainDb > 0"
          type="button"
          class="gain-value"
          v-tooltip.bottom="gainTooltip"
          @click.stop="showGainMenu"
        >
          {{ $t('audio.gainBadge', { db: gainText }) }}
        </button>
        <button
          v-if="canGainUp"
          type="button"
          class="gain-up"
          :aria-label="$t('audio.gainUp')"
          v-tooltip.bottom="$t('audio.gainUpTooltip', { db: nextGainText })"
          @click.stop="gainUp"
        >
          <template v-if="gainDb > 0">+</template>
          <template v-else>{{ $t('audio.gainUpLabel') }}</template>
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
    align-items: center;
  }

  .source-name {
    flex: 1;
    min-width: 0;
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

    // 配信音声が小さく、ここで上げられるときは、ラウドネスパネルと同じ黄色で示す
    &.attention {
      color: var(--color-yellow);
      border-color: currentcolor;
    }

    button {
      height: 100%;
      padding: 0 5px;
      line-height: 16px;
      color: inherit;
      cursor: pointer;
      background: transparent;
      border: 0;

      &:hover {
        background: var(--color-bg-secondary);
      }
    }

    .gain-value + button {
      border-left: 1px solid currentcolor;
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
