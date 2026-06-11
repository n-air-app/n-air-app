<template>
  <div>
    <generic-form-item
      v-for="(parameter, inputIndex) in value"
      :key="parameter.name"
      :parameter="parameter"
      :index="inputIndex"
      :value="value[inputIndex]"
      :category="category"
      :subCategory="subCategory"
      @input="onInputHandler"
    />
  </div>
</template>

<script lang="ts" src="./GenericForm.vue.ts"></script>
