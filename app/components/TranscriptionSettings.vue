<template>
  <div class="setting-section">
    <div class="input-wrapper">
      <a @click="openHelp">{{ help }}<i class="icon-open-blank"></i></a>
    </div>
    <ObsBoolInput v-model="enabledModel" />
    <div v-if="enabledModel.value">
      <div class="section">
        <ObsListInput v-model="audioSourceIdModel" />
      </div>
      <div class="section">
        <ObsListInput v-model="voskModelModel" />
        <div class="action-buttons">
          <button
            class="control-button basic-button"
            data-size="md"
            data-radius="sm"
            data-color="secondary"
            data-variant="light"
            @click="downloadVoskModel()"
            :disabled="!isDownloadButtonEnabled"
          >
            {{ downloadButtonText }}
          </button>
          <button
            class="control-button basic-button"
            data-size="md"
            data-radius="sm"
            data-color="secondary"
            data-variant="light"
            @click="deleteVoskModel()"
            :disabled="!isDeleteButtonEnabled"
          >
            <i class="icon-delete"></i>{{ deleteButtonText }}
          </button>
        </div>
      </div>
      <div class="section" v-if="isActive">
        <h4 class="section-title">{{ preview }}</h4>
        <p>{{ previewText || '--' }}</p>
      </div>
      <div class="notification-root" v-else>
        <i class="notification-icon icon-notification" />
        <p class="notification-message">{{ disabledReason }}</p>
      </div>
      <div class="section" v-if="isNiconicoLoggedIn">
        <h4 class="section-title">{{ commentSectionTitle }}</h4>
        <p>
          {{ commentSectionNotice1 }}
          <a @click="openHelp">{{ help }}<i class="icon-open-blank"></i></a>
        </p>
        <p>{{ commentSectionNotice2 }}</p>
        <ObsIntInput v-model="commentPostDelayModel" />
        <ObsIntInput v-model="commentVposOffsetModel" />
      </div>
      <div class="section">
        <h4 class="section-title">{{ textFileSectionTitle }}</h4>
        <ObsBoolInput v-model="textFileEnabledModel" v-if="!textFileEnabledModel.value" />
        <div v-if="textFileEnabledModel.value">
          <ObsPathInput v-model="textFilePathModel" />
          <ObsIntInput v-model="textFileMaxLineModel" />
          <ObsIntInput v-model="textFileLineTimeToLiveModel" />
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" src="./TranscriptionSettings.vue.ts"></script>

<style lang="less" scoped>
@import url('../styles/index');

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

.notification-root {
  .notification-styling;

  margin-bottom: var(--spacing-lg);
}
</style>
