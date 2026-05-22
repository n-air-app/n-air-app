<template>
  <modal-layout :show-controls="false" no-scroll>
    <div slot="content" class="audio-sources-list">
      <div
        v-for="audioSource in audioSources"
        :key="audioSource.sourceId"
        class="audio-source-card section"
      >
        <div class="source-row">
          <div class="source-name">{{ audioSource.name }}</div>
          <div class="source-rows">
            <div class="source-controls">
              <div
                v-for="formInput in getRow1Controls(audioSource)"
                :key="`${audioSource.name}${formInput.name}`"
                :class="['control-item', 'control-' + formInput.name]"
              >
                <div class="control-label">{{ formInput.description }}</div>
                <component
                  v-if="propertyComponentForType(formInput.type)"
                  :is="propertyComponentForType(formInput.type)"
                  :value="formInput"
                  @input="value => onInputHandler(audioSource, formInput.name, value.value)"
                />
              </div>
            </div>
            <div class="source-controls">
              <div
                v-for="formInput in getRow2Controls(audioSource)"
                :key="`${audioSource.name}${formInput.name}`"
                :class="['control-item', 'control-' + formInput.name]"
              >
                <div class="control-label">{{ formInput.description }}</div>
                <component
                  v-if="propertyComponentForType(formInput.type)"
                  :is="propertyComponentForType(formInput.type)"
                  :value="formInput"
                  @input="value => onInputHandler(audioSource, formInput.name, value.value)"
                />
              </div>
            </div>
            <div class="source-controls">
              <div
                v-for="formInput in getRow3Controls(audioSource)"
                :key="`${audioSource.name}${formInput.name}`"
                :class="['control-item', 'control-' + formInput.name]"
              >
                <div class="control-label">{{ formInput.description }}</div>
                <component
                  v-if="propertyComponentForType(formInput.type)"
                  :is="propertyComponentForType(formInput.type)"
                  :value="formInput"
                  @input="value => onInputHandler(audioSource, formInput.name, value.value)"
                />
              </div>
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

.audio-sources-list {
  flex-grow: 1;
  padding: 8px;
  overflow-y: auto;
}

.audio-source-card {
  padding-bottom: 16px;
  margin-bottom: 16px;

  &:last-child {
    margin-bottom: 0;
  }
}

.source-row {
  display: flex;
  gap: 16px;
  align-items: center;
}

.source-name {
  flex-shrink: 0;
  width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: bold;
  color: var(--color-object-emphasis-high);
  white-space: nowrap;
}

.source-rows {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 10px;
}

.source-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 24px;
  align-items: center;
}

.control-item {
  display: flex;
  flex-shrink: 0;
  flex-direction: row;
  gap: 8px;
  align-items: center;

  :deep(.input-container) {
    display: block;
  }

  :deep(.input-label) {
    display: none;
  }

  :deep(.input-wrapper) {
    width: auto;
    margin-bottom: 0;
  }
}

.control-label {
  font-size: var(--font-size-sm);
  color: var(--color-object-emphasis-medium);
  white-space: nowrap;
}

.control-deflection :deep(input),
.control-syncOffset :deep(input) {
  width: 80px;
}

.control-forceMono {
  flex-direction: row-reverse;
}

.control-monitoringType :deep(.dropdown) {
  width: 300px;
}
</style>
