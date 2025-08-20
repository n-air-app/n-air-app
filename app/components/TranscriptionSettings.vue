<template>
  <div>
    <ObsBoolInput v-model="enabledModel" />
    <div v-if="enabledModel.value">
      <ObsListInput v-model="audioSourceIdModel" />
      <ObsListInput v-model="voskModelModel" />
      <ObsButtonInput :value="downloadButtonModel" />
      <div>
        <h3>プレビュー</h3>
        <p>{{ previewText || '--' }}</p>
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
