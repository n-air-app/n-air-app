<template>
  <div
    :data-test="testingAnchor"
    class="input-container select"
    :class="{ disabled: value.enabled === false }"
  >
    <div v-if="value.showDescription !== false" class="input-label">
      <label>{{ value.description }}</label>
    </div>
    <div class="input-wrapper">
      <dropdown
        :value="currentValue"
        :disabled="value.enabled === false"
        :options="value.options"
        label="description"
        track-by="value"
        @input="onInputHandler"
      >
        <template slot="noResult">
          {{ $t('settings.itemNotFoundMessage') }}
        </template>
      </dropdown>
    </div>
  </div>
</template>

<script lang="ts" src="./ObsResolutionInput.vue.ts"></script>
