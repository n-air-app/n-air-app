<template>
  <div :data-test="testingAnchor" class="input-container">
    <div class="input-label">
      <label>{{ $t('settings.fontSize') }}</label>
    </div>
    <div class="input-wrapper">
      <dropdown
        class="dropdown--font"
        :value="value"
        :options="fontSizePresets"
        @input="setFontSizePreset"
      >
        <template #option="props">
          <span>
            {{ props.option }}
          </span>
        </template>
        <template #noResult>
          {{ $t('settings.itemNotFoundMessage') }}
        </template>
      </dropdown>
    </div>
  </div>
</template>

<script lang="ts" src="./ObsFontSizeSelector.vue.ts"></script>
