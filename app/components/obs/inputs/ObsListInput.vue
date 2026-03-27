<template>
  <div
    :data-test="testingAnchor"
    :data-test-value="currentValue && currentValue.value"
    class="input-container select"
    :class="{ disabled: value.enabled === false }"
  >
    <div v-if="value.showDescription !== false" class="input-label">
      <label>{{ value.description }}</label>
    </div>
    <div class="input-wrapper">
      <dropdown
        :data-test="testingAnchor"
        :value="currentValue"
        :disabled="value.enabled === false"
        :options="value.options"
        label="description"
        track-by="value"
        :placeholder="placeholder || $t('settings.listPlaceholder')"
        :loading="loading"
        @input="onInputHandler"
      >
        <template #option="props">
          <span :data-test="`${props.option.value}`">
            {{ props.option.description }}
          </span>
        </template>
        <template #noResult>
          {{ $t('settings.itemNotFoundMessage') }}
        </template>
      </dropdown>
    </div>
  </div>
</template>

<script lang="ts" src="./ObsListInput.vue.ts"></script>
