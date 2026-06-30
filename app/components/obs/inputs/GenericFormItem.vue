<template>
  <div>
    <component
      v-if="parameter.visible && propertyComponentForType(parameter.type)"
      :is="propertyComponentForType(parameter.type)"
      :value="value"
      :data-test-category="category"
      :data-test-subCategory="subCategory"
      :data-test-i18nkey="parameter.i18nKey"
      @input="onInput"
    />
  </div>
</template>

<script lang="ts" src="./GenericFormItem.vue.ts"></script>
