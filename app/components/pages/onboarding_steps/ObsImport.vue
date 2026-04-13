<template>
  <div data-test="ObsImport">
    <div class="onboarding-step">
      <div class="onboarding-title">{{ title }}</div>
      <div class="onboarding-desc">{{ description }}</div>
      <div v-if="status === 'done'">
        <button class="button button--primary" @click="next">
          {{ $t('common.ok') }}
        </button>
      </div>
      <div v-if="status === 'importing'">
        <i class="importing-spinner icon-spinner icon-spin" />
      </div>
      <div v-if="status !== 'done'">
        <NAirObsLogo />
      </div>
      <div class="obs-import-contents" v-if="status === 'initial'">
        <div v-if="profiles.length > 1">
          <span class="profile-select__title">{{ $t('onboarding.selectObsProfile') }}</span>
          <dropdown
            v-model="selectedProfile"
            :options="profiles"
          />
        </div>
        <div class="button-wrapper">
          <button class="button button--primary" @click="startImport" data-test="Import">
            {{ $t('onboarding.importFromObs') }}
          </button>
          <button class="link link--skip" @click="startFresh" data-test="Skip">
            {{ reImportMode ? $t('common.cancel') : $t('onboarding.skipImport') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" src="./ObsImport.vue.ts"></script>

<style lang="less" scoped>
label {
  text-align: left;
}

.profile-select__title {
  display: block;
  margin-bottom: 16px;
}

.importing-spinner {
  font-size: 32px;
}

.obs-import-contents {
  display: flex;
  flex-direction: column;
  flex-wrap: wrap;
  gap: 32px;
  align-items: center;
  justify-content: center;
  margin-top: 24px;
}

.import-obs-image {
  width: 512px;
  margin: 16px 0;
}

.icon-spin {
  animation: icon-spin 2s infinite linear;
}

.button-wrapper {
  display: flex;
  flex-direction: column;
  gap: 24px;
  align-items: center;
}

.button {
  min-width: 188px;
  height: 40px;
}

// スキップリンク
.link--skip {
  text-decoration: underline;
}

@keyframes icon-spin {
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(359deg);
  }
}
</style>
