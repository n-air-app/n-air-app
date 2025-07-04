<template>
  <div>
    <ObsBoolInput v-model="enabledModel" />
    <ObsListInput v-model="audioSourceIdModel" />
    <ObsBoolInput v-model="textFileEnabledModel" />
    <ObsPathInput v-model="textFilePathModel" />
    <ObsNumberInput v-model="textFileMaxLineModel" />
    <ObsNumberInput v-model="textFileLineTimeToLiveModel" />
  </div>
</template>

<script lang="ts" src="./TranscriptionSettings.vue.ts"></script>

<style lang="less">
@import url('../styles/index');
</style>
