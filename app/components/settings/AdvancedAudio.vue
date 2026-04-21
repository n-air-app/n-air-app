<template>
  <modal-layout :show-controls="false" no-scroll>
    <div slot="content" class="audio-sources-list">
      <div
        v-for="audioSource in audioSources"
        :key="audioSource.sourceId"
        class="audio-source-card section"
      >
        <div class="source-header">
          <div class="source-name">{{ audioSource.name }}</div>
          <div class="source-primary-controls">
            <div
              v-for="formInput in getPrimaryControls(audioSource)"
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
          <button class="expand-toggle" @click="toggleExpand(audioSource.sourceId)">
            <i class="icon-drop-down-arrow" :class="{ 'is-expanded': isExpanded(audioSource.sourceId) }" />
          </button>
        </div>
        <div v-if="isExpanded(audioSource.sourceId)" class="source-detail-controls">
          <div
            v-for="formInput in getDetailControls(audioSource)"
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
  margin-bottom: 8px;

  &:last-child {
    margin-bottom: 0;
  }
}

.source-header {
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

.source-primary-controls {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  gap: 8px 24px;
  align-items: center;
}

.expand-toggle {
  flex-shrink: 0;
  padding: 4px 8px;
  color: var(--color-object-emphasis-medium);
  cursor: pointer;
  background: transparent;
  border: none;

  &:hover {
    color: var(--color-object-emphasis-high);
  }

  i {
    display: inline-block;
    transition: transform 0.2s;

    &.is-expanded {
      transform: rotate(180deg);
    }
  }
}

.source-detail-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 24px;
  align-items: center;
  padding-top: 12px;
  margin-top: 8px;
  border-top: 1px solid var(--color-border-emphasis-low);
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
