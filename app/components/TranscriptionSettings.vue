<template>
  <div>
    <ObsBoolInput v-model="enabledModel" />
    <div v-if="enabledModel.value">
      <ObsListInput v-model="audioSourceIdModel" />
      <ObsListInput v-model="voskModelModel" />
      <ObsButtonInput :value="downloadButtonModel" />
      <div v-if="isActive">
        <h3>プレビュー</h3>
        <p>{{ previewText || '--' }}</p>
      </div>
      <div v-else>
        <p>音声認識が無効です</p>
      </div>
      <ObsBoolInput v-model="textFileEnabledModel" />
      <div v-if="textFileEnabledModel.value">
        <ObsPathInput v-model="textFilePathModel" />
        <ObsNumberInput v-model="textFileMaxLineModel" />
        <ObsNumberInput v-model="textFileLineTimeToLiveModel" />
      </div>
    </div>
  </div>
</template>

<script lang="ts" src="./TranscriptionSettings.vue.ts"></script>

<style lang="less">
@import url('../styles/index');
</style>
