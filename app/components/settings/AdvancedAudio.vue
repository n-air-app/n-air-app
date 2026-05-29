<template>
  <modal-layout :show-controls="false" no-scroll>
    <div slot="content" class="content">
      <div
        v-for="(audioSource, index) in audioSources"
        :key="audioSource.sourceId"
      >
        <div v-if="index > 0" class="divider" />
        <div class="source-row">
          <div class="source-name">{{ sourceName(audioSource) }}</div>
          <div class="controls">
            <div
              v-for="formInput in audioSource.getSettingsForm()"
              :key="`${audioSource.sourceId}${formInput.name}`"
              :class="['field', 'column-' + formInput.name]"
            >
              <component
                v-if="propertyComponentForType(formInput.type)"
                :is="propertyComponentForType(formInput.type)"
                :value="{ ...formInput, showDescription: true }"
                @input="onInputHandler(audioSource, formInput.name, $event.value)"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </modal-layout>
</template>

<script lang="ts" src="./AdvancedAudio.vue.ts"></script>

<style lang="less" scoped>
@import url('../../styles/index');

.content {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow-y: auto;
  background-color: var(--color-background);
}

.divider {
  height: 1px;
  background-color: var(--color-border-emphasis-low);
}

.source-row {
  display: flex;
  gap: var(--spacing-2xl);
  align-items: center;
  padding: var(--spacing-lg);
}

.source-name {
  flex-shrink: 0;
  width: 160px;
  font-size: var(--font-size-sm);
  font-weight: 700;
  color: var(--color-object-emphasis-high);
  overflow-wrap: break-word;
}

.controls {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xl);
  align-items: flex-start;
  min-width: 0;
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.column-monitoringType {
  width: 300px;
}

.column-deflection {
  width: 90px;
}

.column-syncOffset {
  width: 126px;
}

.column-audioMixers {
  /* stylelint-disable-next-line selector-pseudo-element-no-unknown */
  ::v-deep .input-wrapper {
    display: flex;
    align-items: center;
    height: @item-generic-size;
  }
}

.column-forceMono {
  width: 160px;
}

/* stylelint-disable-next-line selector-pseudo-element-no-unknown */
::v-deep .input-container {
  flex-direction: column;

  .input-label,
  .input-wrapper {
    width: 100%;
    margin-bottom: 0;
  }

  .input-label {
    margin-bottom: 0;

    label {
      margin-bottom: var(--spacing-sm);
    }
  }
}
</style>
