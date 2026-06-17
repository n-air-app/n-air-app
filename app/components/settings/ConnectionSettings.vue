<template>
  <div>
    <ObsListInput :value="fromSceneModel" @input="fromSceneModel = $event" />
    <ObsListInput :value="transitionModel" @input="transitionModel = $event" />
    <ObsListInput :value="toSceneModel" @input="toSceneModel = $event" />
  </div>
</template>

<script lang="ts" src="./ConnectionSettings.vue.ts"></script>
