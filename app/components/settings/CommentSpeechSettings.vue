<template>
  <div class="setting-section">
    <toc-section title="読み上げ">
      <div class="section">
        <div class="input-label section-heading">
          <label>読み上げ</label>
        </div>
        <div class="input-container">
          <div class="input-wrapper">
            <div class="row">
              <div class="name">コメントを読み上げる</div>
              <div class="value">
                <input type="checkbox" v-model="synthesizerEnabled" class="toggle-button" />
              </div>
            </div>
          </div>
        </div>

        <toc-section title="音声" :visible="synthesizerEnabled">
          <div class="section" v-if="synthesizerEnabled">
            <div class="input-label section-heading">
              <label>音声</label>
            </div>
            <div class="input-container">
              <div class="input-wrapper">
                <div class="row">
                  <div class="name">速度</div>
                  <div class="value">×{{ rate }}<span v-if="rate == rateDefault">（既定）</span></div>
                </div>
                <slider
                  v-model="rate"
                  :disabled="!synthesizerEnabled"
                  :data="rateCandidates"
                  tooltip="hover"
                />
              </div>
              <div class="input-wrapper">
                <div class="row">
                  <div class="name">音量</div>
                  <div class="value">
                    {{ volume }}<span v-if="volume == volumeDefault">（既定）</span>
                  </div>
                </div>
                <slider
                  v-model="volume"
                  :disabled="!synthesizerEnabled"
                  :data="volumeCandidates"
                  tooltip="hover"
                />
              </div>
            </div>
            <button
              :disabled="!synthesizerEnabled"
              @click="resetVoice"
              data-size="md"
              data-radius="sm"
              data-color="secondary"
              data-variant="light"
              class="basic-button"
            >
              設定リセット
            </button>
          </div>
        </toc-section>

        <toc-section title="振り分け" :visible="synthesizerEnabled">
          <div class="section" v-if="synthesizerEnabled">
            <div class="input-label section-heading">
              <label>振り分け</label>
            </div>
            <div class="input-container">
              <div v-if="voicevoxInformation" class="banner">
                <div class="banner-header">N Air上でVOICEVOXの音声が選択できるようになりました</div>
                <div class="banner-body">
                  VOICEVOXを起動して、好きなキャラクターに読み上げてもらおう
                </div>
                <a class="banner-anchor" @click="showVoicevoxInformation()"
                >VOICEVOXで音声を読み上げるには<i class="icon-open-blank"></i
                ></a>
                <div class="banner-close">
                  <i class="icon-close icon-btn" @click="closeVoicevoxInformation"></i>
                </div>
              </div>

              <div
                v-if="isUseVoicevox && !isExistVoicevox && !isLoadingVoicevox"
                class="banner"
                data-type="error"
              >
                <div class="banner-header">VOICEVOXを起動してください</div>
                <a class="banner-anchor" @click="showVoicevoxInformation()"
                >VOICEVOXで音声を読み上げるには<i class="icon-open-blank"></i
                ></a>
              </div>

              <!-- system -->
              <div class="input-label">
                <label :class="{ label_error: system.id == 'voicevox' && !isExistVoicevox }">
                  システムメッセージ
                </label>
              </div>
              <div class="select-wrapper">
                <DropdownIcon v-model="system" :options="synthesizers" />
                <DropdownIcon
                  v-if="system.id == 'voicevox'"
                  v-model="voicevoxSystemItem"
                  :options="voicevoxItems"
                  :disabled="!isExistVoicevox"
                  :searchable="true"
                />
                <button
                  class="action-icon"
                  data-size="lg"
                  data-variant="light"
                  data-radius="sm"
                  data-color="secondary"
                  :disabled="!isTestable(system.id)"
                  @click="testSpeechPlay(system.id, 'system')"
                >
                  <i class="icon-sound-fill"></i>
                </button>
              </div>
              <!--normal -->
              <div class="input-label">
                <label :class="{ label_error: normal.id == 'voicevox' && !isExistVoicevox }">
                  視聴者コメント
                </label>
              </div>
              <div class="select-wrapper">
                <DropdownIcon v-model="normal" :options="synthesizers" />
                <DropdownIcon
                  v-if="normal.id == 'voicevox'"
                  v-model="voicevoxNormalItem"
                  :options="voicevoxItems"
                  :disabled="!isExistVoicevox"
                  :searchable="true"
                />
                <button
                  class="action-icon"
                  data-size="lg"
                  data-variant="light"
                  data-radius="sm"
                  data-color="secondary"
                  :disabled="!isTestable(normal.id)"
                  @click="testSpeechPlay(normal.id, 'normal')"
                >
                  <i class="icon-sound-fill"></i>
                </button>
              </div>

              <!-- operator -->
              <div class="input-label">
                <label :class="{ label_error: operator.id == 'voicevox' && !isExistVoicevox }">
                  放送者コメント
                </label>
              </div>
              <div class="select-wrapper">
                <DropdownIcon v-model="operator" :options="synthesizers" />
                <DropdownIcon
                  v-if="operator.id == 'voicevox'"
                  v-model="voicevoxOperatorItem"
                  :options="voicevoxItems"
                  :disabled="!isExistVoicevox"
                  :searchable="true"
                />
                <button
                  class="action-icon"
                  data-size="lg"
                  data-variant="light"
                  data-radius="sm"
                  data-color="secondary"
                  :disabled="!isTestable(operator.id)"
                  @click="testSpeechPlay(operator.id, 'operator')"
                >
                  <i class="icon-sound-fill"></i>
                </button>
              </div>
              <!-- end -->
              <button
                @click="resetAssignment"
                data-size="md"
                data-radius="sm"
                data-color="secondary"
                data-variant="light"
                class="basic-button"
              >
                設定リセット
              </button>
            </div>
          </div>
        </toc-section>

        <toc-section title="音声エンジン" id="speech-engine-settings" :visible="synthesizerEnabled">
          <div class="section" v-if="synthesizerEnabled">
            <div class="input-label section-heading">
              <label>音声エンジン</label>
            </div>
            <speech-engine-settings />
          </div>
        </toc-section>
      </div>
    </toc-section>

    <sound-detector-settings v-if="synthesizerEnabled" />
  </div>
</template>

<script lang="ts" src="./CommentSpeechSettings.vue.ts"></script>
<style lang="less" scoped>
@import url('../../styles/index');

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

.banner {
  position: relative;
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  padding: 12px 16px;
  margin-bottom: 16px;
  background-color: var(--color-surface-primary);
  border: 1px solid var(--color-border-emphasis-low);

  .radius();

  &[data-type='error'] {
    background-color: color-mix(in srgb, var(--color-caution-primary) 15%, transparent);
    border: none;
  }
}

.banner-header {
  .bold();

  padding-right: 16px;
  color: var(--color-object-emphasis-high);

  [data-type='error'] & {
    color: var(--color-caution-primary);
  }
}

.banner-body {
  color: var(--color-object-emphasis-medium);
}

.banner-anchor {
  display: flex;
  gap: 8px;
  align-items: center;
}

.banner-close {
  position: absolute;
  top: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;

  i {
    margin: 0;
  }
}

.label_error {
  color: var(--color-caution-primary);
}

.select-wrapper {
  display: flex;
  gap: 8px;
  align-items: center;
  width: 100%;
  margin-bottom: 16px;

  .dropdown {
    flex-grow: 1;

    & + .dropdown {
      flex-grow: 1.4;
    }
  }

  .action-icon {
    flex-shrink: 0;
  }
}
</style>
