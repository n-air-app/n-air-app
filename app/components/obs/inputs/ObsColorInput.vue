<template>
  <div :data-test="testingAnchor">
    <div class="input-container">
      <div class="input-label">
        <label>{{ value.description }}</label>
      </div>
      <div class="input-wrapper">
        <div class="colorpicker">
          <div class="colorpicker__text" @click="togglePicker">
            <input class="colorpicker__input" type="text" readonly :value="hexARGB" />
            <div class="colorpicker__swatch" :style="swatchStyle" />
          </div>
          <button class="colorpicker__eyedropper" @click="startEyedropper" title="Color picker">
            <i class="icon-eyedropper" />
          </button>
          <color-picker
            :value="obsColor"
            @input="handleColorChange"
            v-if="pickerVisible"
            class="colorpicker-menu"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" src="./ObsColorInput.vue.ts"></script>

<style lang="less">
@import url('../../../styles/index');

.colorpicker {
  position: relative;
  width: 220px;
}

.colorpicker__text {
  position: relative;
  cursor: pointer;
}

.colorpicker__input {
  cursor: pointer !important;
}

.colorpicker__swatch {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 20px;
  height: 20px;
  border: 1px solid #ccc;
  border-radius: 2px;
}

.colorpicker__eyedropper {
  position: absolute;
  top: 50%;
  right: 34px;
  padding: 0;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  background: none;
  border: none;
  opacity: 0.7;
  transform: translateY(-35%);
  transition: opacity 0.2s;

  &:hover {
    opacity: 1;
  }
}

.colorpicker-menu {
  top: 6px;
  z-index: 10;
  .radius() !important;

  background: @bg-secondary !important;
  border-color: @bg-secondary !important;
  box-shadow: none !important;

  .vc-sketch-field .vc-input__input {
    background-color: @bg-primary !important;
  }

  .vc-input__label {
    color: @text-primary !important;
  }
}

.vue-color__sketch__presets {
  border-color: @border;
}
</style>
