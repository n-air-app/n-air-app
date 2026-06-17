<template>
  <modal-layout
    :title="windowTitle"
    :done-handler="done"
    :cancel-handler="cancel"
    :fixedSectionHeight="200"
  >
    <template #fixed><display v-if="source" :sourceId="source.id" /></template>
    <template #content>
      <component
        v-if="propertiesManagerUI"
        :is="propertiesManagerUI"
        :source="source"
        @update="refresh"
      />
      <GenericForm :value="properties" @input="onInputHandler" />
    </template>
  </modal-layout>
</template>

<script lang="ts" src="./SourceProperties.vue.ts"></script>
