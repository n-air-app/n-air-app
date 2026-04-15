<template>
  <div class="setting-section">
    <div>
      <div class="section">
        <div class="input-container">
          <div class="input-wrapper">
            <div class="row">
              <div class="name">
                {{ $t('settings.transcription.enable')
                }}<i
                  class="icon-help-border icon-tooltip"
                  v-tooltip.bottom="commentSectionNotice1"
                ></i>
              </div>
              <div class="value">
                <input type="checkbox" v-model="enabled" class="toggle-button" />
              </div>
            </div>
          </div>
        </div>
        <p class="section-notice-text">
          {{ $t('settings.transcription.help.beforeLink') }}
          <a class="link--underline" @click="openHelp">{{
            $t('settings.transcription.help.linkText')
          }}</a>
          {{ $t('settings.transcription.help.afterLink') }}
        </p>
      </div>
    </div>
    <div>
      <div class="section">
        <div class="input-label section-heading">
          <label>{{ $t('settings.transcription.audioSettings') }}</label>
        </div>
        <ObsListInput v-model="audioSourceIdModel" />
        <div class="input-container">
          <div class="input-label">
            <label>{{ $t('settings.transcription.voskModel') }}</label>
          </div>
          <div class="select-button-wrapper">
            <ObsListInput v-model="voskModelModel" />
            <button
              class="action-icon"
              data-size="md"
              data-variant="light"
              data-radius="sm"
              data-color="secondary"
              v-tooltip="$t(downloadButtonText)"
              @click="downloadVoskModel()"
              v-if="isDownloadButtonEnabled"
            >
              <i class="icon-download-fill"></i>
            </button>
            <button
              class="action-icon"
              data-size="md"
              data-variant="light"
              data-radius="sm"
              data-color="secondary"
              v-tooltip="$t(cancelButtonText)"
              @click="cancelDownloadVoskModel()"
              v-if="isCancelButtonEnabled"
            >
              <i class="icon-close"></i>
            </button>
            <button
              class="action-icon"
              data-size="md"
              data-variant="light"
              data-radius="sm"
              data-color="secondary"
              v-tooltip="$t(deleteButtonText)"
              @click="deleteVoskModel()"
              v-if="isDeleteButtonEnabled"
            >
              <i class="icon-trash-fill"></i>
            </button>
          </div>
        </div>
        <div class="input-container">
          <div class="input-label">
            <label>{{ preview }}</label>
          </div>
          <div class="preview-text">
            <p v-if="activeStatus === 'active'">{{ previewText || '--' }}</p>
            <p class="disabled-reason" v-else>{{ disabledReason }}</p>
          </div>
        </div>
      </div>
    </div>
    <div>
      <div class="section">
        <div class="input-label section-heading">
          <label>{{ $t('settings.transcription.displaySettings') }}</label>
        </div>
        <p
          class="alert"
          data-variant="light"
          data-type="caution"
          v-if="commentEnabled && transcriptionSourceInActiveScene && isNiconicoLoggedIn()"
        >
          <i class="icon-warning-circle"></i>
          {{ $t('settings.transcription.warningBothActive') }}
        </p>
        <p
          class="alert"
          data-variant="light"
          v-if="
            enabled && !commentEnabled && !transcriptionSourceInActiveScene && isNiconicoLoggedIn()
          "
        >
          <i class="icon-notification"></i>
          {{ $t('settings.transcription.warningNoOutput') }}
        </p>
        <p
          class="alert"
          data-variant="light"
          v-if="enabled && !transcriptionSourceInActiveScene && !isNiconicoLoggedIn()"
        >
          <i class="icon-notification"></i>
          {{ $t('settings.transcription.warningNoOutput2') }}
        </p>
        <div class="select-button-wrapper">
          <div class="name">
            {{ $t('settings.transcription.addSourceSection.title')
            }}<i
              class="icon-help-border icon-tooltip"
              v-tooltip.bottom="$t(commentSectionNotice2)"
            ></i>
          </div>
          <button
            v-if="!transcriptionSourceInActiveScene"
            class="button basic-button"
            data-size="xs"
            data-radius="sm"
            data-variant="light"
            data-color="secondary"
            @click="addTranscriptionSourceToActiveScene"
          >
            {{ $t('settings.transcription.addSourceSection.add') }}
          </button>
          <div class="chip" v-else>
            <i class="icon-check-circle-fill"></i
            >{{ $t('settings.transcription.addSourceSection.added') }}
          </div>
        </div>
        <div class="section" v-if="transcriptionSourceInActiveScene">
          <h4 class="section-title">{{ textFileSectionTitle }}</h4>
          <ObsBoolInput v-model="textFileEnabledModel" v-if="!textFileEnabledModel.value" />
          <div v-if="textFileEnabledModel.value">
            <ObsIntInput v-model="textFileMaxLineModel" />
            <ObsIntInput v-model="textFileLineTimeToLiveModel" />
          </div>
        </div>
        <div class="input-container" v-if="isNiconicoLoggedIn()">
          <div class="input-wrapper">
            <div class="row">
              <div class="name">{{ $t('settings.transcription.comment.enable') }}</div>
              <div class="value">
                <input type="checkbox" v-model="commentEnabled" class="toggle-button" />
              </div>
            </div>
          </div>
        </div>
        <div class="section" v-if="isNiconicoLoggedIn() && commentEnabled">
          <div class="input-label section-heading">
            <label>
              {{ commentSectionTitle
              }}<i
                class="icon-help-border icon-tooltip"
                v-tooltip.bottom="$t(commentSectionNotice3)"
              ></i
              ></label>
          </div>
          <p class="section-notice-text">{{ commentSectionNotice4 }}</p>
          <div>
            <ObsListInput v-model="commentSizeModel" />
            <ObsListInput v-model="commentPositionModel" />
            <ObsListInput v-model="commentColorModel" />
            <ObsListInput v-model="commentFontModel" />
            <ObsIntInput v-model="commentPostDelayModel" />
            <ObsIntInput v-model="commentVposOffsetModel" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" src="./TranscriptionSettings.vue.ts"></script>

<style lang="less" scoped>
@import url('../../styles/index');

.row {
  display: flex;
  flex-direction: row;
  align-items: center;
  width: 100%;
}

.name {
  display: flex;
  flex-grow: 1;
  align-items: center;
  font-size: @font-size4;
  color: var(--color-object-emphasis-medium);
}

.value {
  display: flex;
  align-items: center;
  color: var(--color-object-emphasis-high);
}

p.error {
  color: var(--color-error);
}

.action-buttons {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.control-button {
  margin: 0;
}

.disabled-reason {
  color: var(--color-object-emphasis-low);
}

.notification-root {
  .notification-styling();

  margin-bottom: var(--spacing-lg);
}

.preview-text {
  width: 100%;
  padding: var(--spacing-lg);
  margin-bottom: var(--spacing-lg);
  border: 1px solid var(--color-border-emphasis-low);

  p {
    margin: 0;
    line-height: var(--line-height-xs);
  }
}

/* TODO: 以下は追って汎用コンポーネント化します */
.chip {
  display: flex;
  gap: var(--spacing-xs);
  align-items: center;
  height: 24px;
  padding: 0 var(--spacing-sm);
  font-size: var(--font-size-xs);
  line-height: var(--line-height-xs);
  color: var(--color-object-emphasis-medium);
  background-color: var(--color-surface-primary);
}

.alert {
  display: flex;
  gap: var(--spacing-lg);
  align-items: center;
  padding: var(--spacing-lg);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-lg);
  color: var(--text-color, var(--color-object-emphasis-high));
  background-color: var(--bg-color, var(--color-highlight-medium));
  border-color: var(--border-color, var(--color-border-emphasis-low));
  border-style: solid;
  border-width: var(--border-width, 1px);
  border-radius: var(--radius-sm);

  &[data-variant='light'] {
    --border-width: 0;
  }

  &[data-variant='outline'] {
    --bg-color: transparent;
  }

  &[data-type='caution'] {
    --border-color: var(--color-caution-primary);
    --text-color: var(--color-caution-primary);
    --bg-color: var(--color-caution-light);
  }
}
</style>
