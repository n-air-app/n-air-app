<template>
  <modal-layout :done-handler="done" :cancel-handler="cancel">
    <template #content>
      <div>
        <ObsListInput :value="form.type" @input="v => { form.type = v; setTypeAsName(); }"></ObsListInput>
        <ObsTextInput :value="form.name" @input="form.name = $event"></ObsTextInput>
        <p v-if="error" style="color: red">
          {{ error }}
        </p>
      </div>
    </template>
  </modal-layout>
</template>

<script lang="ts" src="./AddSourceFilter.vue.ts"></script>
