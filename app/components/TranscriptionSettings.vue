<template>
  <div class="setting-section">
    <div class="section">
      <div class="input-label section-heading">
        <label>自動文字起こし</label>
      </div>
      <div class="input-container">
        <div class="input-wrapper">
          <div class="row">
            <div class="name">{{ $t('settings.transcription.enable') }}</div>
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
    <div class="section">
      <div class="input-label section-heading">
        <label>{{ $t('settings.transcription.audioSource') }}</label>
      </div>
      <ObsListInput v-model="audioSourceIdModel" />
    </div>
    <div class="section">
      <div class="input-label section-heading">
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
          v-tooltip="$t(deleteButtonText)"
          @click="deleteVoskModel()"
          v-if="isDeleteButtonEnabled"
        >
          <i class="icon-trash-fill"></i>
        </button>
      </div>
    </div>
    <div class="section">
      <div class="input-label section-heading">
        <label>{{ preview }}</label>
      </div>
      <p v-if="activeStatus === 'active'">{{ previewText || '--' }}</p>
      <p class="disabled-reason" v-else>{{ disabledReason }}</p>
    </div>
    <div class="section" v-if="isNiconicoLoggedIn">
      <div class="input-label section-heading">
        <label>
          {{ commentSectionTitle
          }}<i
            class="icon-help-border icon-tooltip"
            v-tooltip.bottom="$t(commentSectionNotice1)"
          ></i
        ></label>
      </div>
      <p class="section-notice-text">{{ commentSectionNotice2 }}</p>
      <div class="input-container">
        <div class="input-wrapper">
          <div class="row">
            <div class="name">{{ $t('settings.transcription.comment.enable') }}</div>
            <div class="value">
              <input type="checkbox" v-model="commentEnabled" class="toggle-button" />
            </div>
          </div>
        </div>
      </div>
      <div v-if="commentEnabled">
        <ObsListInput v-model="commentSizeModel" />
        <ObsListInput v-model="commentPositionModel" />
        <ObsListInput v-model="commentColorModel" />
        <ObsListInput v-model="commentFontModel" />
        <ObsIntInput v-model="commentPostDelayModel" />
        <ObsIntInput v-model="commentVposOffsetModel" />
      </div>
    </div>
    <div class="section">
      <h4 class="section-title">{{ textFileSectionTitle }}</h4>
      <ObsBoolInput v-model="textFileEnabledModel" v-if="!textFileEnabledModel.value" />
      <div v-if="textFileEnabledModel.value">
        <ObsIntInput v-model="textFileMaxLineModel" />
        <ObsIntInput v-model="textFileLineTimeToLiveModel" />
      </div>
    </div>
  </div>
</template>

<script lang="ts" src="./TranscriptionSettings.vue.ts"></script>

<style lang="less" scoped>
@import url('../styles/index');

.row {
  display: flex;
  flex-direction: row;
  align-items: center;
  width: 100%;
}

.name {
  flex-grow: 1;
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
  .notification-styling;

  margin-bottom: var(--spacing-lg);
}
</style>
