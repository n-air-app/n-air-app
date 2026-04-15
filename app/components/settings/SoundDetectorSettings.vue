<template>
  <div class="setting-section">
    <toc-section title="読み上げ停止設定" id="sound-detector-settings">
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
      </div>

      <toc-section title="基本設定">
        <div class="section">
          <div class="input-label section-heading">
            <label>基本設定</label>
          </div>
          <ObsListInput v-model="soundDetectorSourceModel" />
          <p v-if="!sourceAvailable" class="source-unavailable-warning">
            選択したソースがこのシーンに存在しません。入力音声ソースを選び直してください。
          </p>
          <ObsSliderInput v-model="soundThresholdDbModel" />
        </div>
      </toc-section>

      <toc-section title="コメント読み上げテスト">
        <div class="section">
          <div class="input-label section-heading">
            <label>コメント読み上げテスト</label>
          </div>
          <div v-if="soundDetectorSourceModel.value !== null">
            <div class="sound-detector-volmeter-label">
              音声検出:
              <template v-if="soundDetectorEnabled">
                <span v-if="soundDetected === 'loud'">しゃべっています</span>
                <span v-else-if="soundDetected === 'no-signal'">無音(信号なし)</span>
                <span v-else>静か</span>
                <span v-if="sourceMuted">(ミュート状態)</span>
              </template>
              <span v-else>設定がOFFです</span>
            </div>
            <div class="sound-detector-volmeter-container">
              <SoundDetectorVolmeter
                v-for="audioSource in soundDetectorAudioSources"
                :audioSource="audioSource"
                :threshold="soundThresholdDbModel.value"
                :enabled="soundDetectorEnabled"
                :key="audioSource.sourceId"
              />
            </div>

            <button
              v-if="!isTestPlaybackActive"
              data-color="secondary"
              data-size="md"
              data-variant="light"
              data-radius="sm"
              class="basic-button"
              :disabled="!synthesizerEnabled || !soundDetectorEnabled"
              @click="startContinuousPlayback"
            >
              テストを開始
            </button>
            <button
              v-else
              data-color="primary"
              data-size="md"
              data-variant="filled"
              data-radius="sm"
              class="basic-button"
              :disabled="!soundDetectorEnabled"
              @click="stopContinuousPlayback"
            >
              テストを停止
            </button>

            <p class="section-notice-text">テスト用の視聴者コメントを読み上げます。スピーカーで鳴らした音声がマイクに入らないよう注意してください</p>

          </div>
        </div>
      </toc-section>

      <toc-section title="詳細設定">
        <div class="section">
          <div class="input-label section-heading--dropdown" :class="{ 'is-collapsed': collapsed }" @click="collapsed = !collapsed">
            <label>詳細設定</label>
            <i :class="collapsed ? 'icon-arrow-bottom-fill' : 'icon-arrow-top-fill'" />
          </div>
          <div v-if="!collapsed">
            <ObsSliderInput v-model="resumeSilenceMsModel" />
            <ObsListInput v-model="soundDetectedSpeechActionModel" />
          </div>
        </div>
      </toc-section>
    </toc-section>
  </div>
</template>
<script lang="ts" src="./SoundDetectorSettings.vue.ts"></script>
<style lang="less" scoped>
@import url('../../styles/index');

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
  }

.sound-detector-volmeter-label {
  font-size: var(--font-size-xs);
  color: var(--color-object-emphasis-medium);
}

.source-unavailable-warning {
  margin: 4px 0;
  font-size: var(--font-size-xs);
  color: var(--color-warning);
}
</style>
