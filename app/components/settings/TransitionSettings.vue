<template>
  <div>
    <ObsTextInput :value="nameModel" @input="nameModel = $event" />
    <ObsListInput :value="typeModel" @input="typeModel = $event" />
    <ObsIntInput :value="durationModel" @input="durationModel = $event" />

    <GenericForm :value="properties" @input="saveProperties"></GenericForm>
  </div>
</template>

<script lang="ts" src="./TransitionSettings.vue.ts"></script>
