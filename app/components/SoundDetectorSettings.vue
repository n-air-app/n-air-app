<template>
  <div class="setting-section">
    <div class="section">
      <div class="input-label section-heading">
        <label>読み上げ停止設定</label>
      </div>
      <p class="section-notice-text">放送者の発声中にコメント読み上げを一時停止する設定です</p>
      <div class="input-container">
        <div class="input-wrapper">
          <div class="row">
            <div class="name">有効にする</div>
            <div class="value">
              <input type="checkbox" v-model="soundDetectorEnabled" class="toggle-button" />
            </div>
          </div>
        </div>
      </div>

      <div class="section" v-if="soundDetectorEnabled">
        <div class="input-label section-heading">
          <label>基本設定</label>
        </div>
        <ObsListInput v-model="soundDetectorSourceModel" />
        <ObsSliderInput v-model="soundThresholdDbModel" />
        <p v-if="!isCalibrated" class="section-notice-text">コメントの読み上げを一時停止する最低音量を設定してください</p>
      </div>

      <div class="section" v-if="soundDetectorEnabled">
        <div class="input-label section-heading">
          <label>コメント読み上げテスト</label>
        </div>
        <div v-if="soundDetectorSourceModel.value !== null">
          <div class="sound-detector-volmeter-label">
            音声検出:
            <span v-if="soundDetected === 'loud'">しゃべっています</span>
            <span v-else-if="soundDetected === 'no-signal'">無音(信号なし)</span>
            <span v-else>静か</span>
            <span v-if="sourceMuted">(ミュート状態)</span>
          </div>
          <div class="sound-detector-volmeter-container">
            <SoundDetectorVolmeter
              v-for="audioSource in soundDetectorAudioSources"
              :audioSource="audioSource"
              :threshold="soundThresholdDbModel.value"
              :key="audioSource.sourceId"
            />
          </div>

          <button
            v-if="!isTestPlaybackActive"
            class="button button--secondary"
            :disabled="!synthesizerEnabled"
            @click="startContinuousPlayback"
          >
            テストを開始
          </button>
          <button
            v-else
            class="button button--primary"
            @click="stopContinuousPlayback"
          >
            テストを停止
          </button>

          <p class="section-notice-text">テスト用の視聴者コメントを読み上げます。スピーカーで鳴らした音声がマイクに入らないよう注意してください</p>

        </div>
      </div>

      <div class="section" v-if="soundDetectorEnabled">
        <div class="input-label section-heading--dropdown" :class="{ 'is-collapsed': collapsed }" @click="collapsed = !collapsed">
          <label>詳細設定</label>
          <i :class="collapsed ? 'icon-arrow-bottom-fill' : 'icon-arrow-top-fill'" />
        </div>
        <div v-if="!collapsed">
          <ObsSliderInput v-model="resumeSilenceMsModel" />
          <ObsListInput v-model="soundDetectedSpeechActionModel" />
        </div>
      </div>

    </div>
  </div>
</template>
<script lang="ts" src="./SoundDetectorSettings.vue.ts"></script>
<style lang="less" scoped>
@import url('../styles/index');

.input-label {
  width: 100%;
}

.row {
  display: flex;
  flex-direction: row;
  align-items: center;
  width: 100%;
}

.name {
  flex-grow: 1;
  font-size: @font-size4;
  color: var(--color-text);
}

.value {
  display: flex;
  align-items: center;
  color: var(--color-text);
}


.sound-detector-volmeter-container {
  width: 100%;
  margin-bottom: var(--spacing-lg);
  background-color: color-mix(in srgb, #411431 40%, transparent);
  }

.sound-detector-volmeter-label {
  font-size: var(--font-size-xs);
  color: var(--color-object-emphasis-medium);
}
</style>
