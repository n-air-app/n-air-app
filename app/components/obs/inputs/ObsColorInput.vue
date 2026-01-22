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
          <color-picker
            :value="obsColor"
            @input="value => setValue(value.rgba)"
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

.colorpicker-menu {
  position: absolute;
  top: 36px;
  z-index: 10;
  .radius !important;

  background: @bg-secondary !important;
  border-color: @bg-secondary !important;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 30%) !important;
}

.vue-color__editable-input__label {
  color: @text-primary !important;
}

.vue-color__sketch__presets {
  border-color: @border;
}
</style>
