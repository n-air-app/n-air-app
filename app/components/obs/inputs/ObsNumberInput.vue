<template>
  <div
    :data-test="testingAnchor"
    class="input-container number-input-container"
    :class="{ disabled: value.enabled == false }"
  >
    <div class="input-label">
      <label v-if="value.showDescription !== false">{{ value.description }}</label>
    </div>
    <div class="input-wrapper">
      <div class="number-input">
        <input
          ref="input"
          type="text"
          :value="value.value"
          @wheel="onMouseWheelHandler"
          :disabled="value.enabled == false"
          @change="updateValue($event)"
        />
        <div class="arrows" @wheel="onMouseWheelHandler">
          <div class="arrow arrow-up" @click="increment">
            <i class="icon-drop-up-arrow"></i>
          </div>
          <div class="arrow arrow-down" @click="decrement">
            <i class="icon-drop-down-arrow"></i>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" src="./ObsNumberInput.vue.ts"></script>
