<template>
  <div>
    <ObsBoolInput v-model="enableTranscriptionModel" />
    <ObsListInput v-model="transcriptionAudioSourceModel" />
  </div>
</template>

<script lang="ts" src="./TranscriptionSettings.vue.ts"></script>

<style lang="less">
@import url('../styles/index');
</style>
