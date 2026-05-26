<template>
  <div class="color-picker" @mousedown.stop @click.stop>
    <!-- Saturation/Brightness 2D picker -->
    <div
      class="color-picker__saturation"
      :style="{ background: hueBackground }"
      ref="saturation"
      @mousedown="onSaturationMouseDown"
    >
      <div class="color-picker__saturation-white" />
      <div class="color-picker__saturation-black" />
      <div
        class="color-picker__saturation-pointer"
        :style="{ top: satPointerTop, left: satPointerLeft }"
      >
        <div class="color-picker__saturation-circle" />
      </div>
    </div>

    <div class="color-picker__controls">
      <!-- Hue slider -->
      <div class="color-picker__sliders">
        <div class="color-picker__hue" ref="hue" @mousedown="onHueMouseDown">
          <div class="color-picker__hue-gradient" />
          <div
            class="color-picker__slider-pointer"
            :style="{ left: huePointerLeft }"
          />
        </div>

        <!-- Alpha slider -->
        <div class="color-picker__alpha" ref="alpha" @mousedown="onAlphaMouseDown">
          <div class="color-picker__alpha-checkerboard" />
          <div
            class="color-picker__alpha-gradient"
            :style="{ background: alphaGradient }"
          />
          <div
            class="color-picker__slider-pointer"
            :style="{ left: alphaPointerLeft }"
          />
        </div>
      </div>

      <!-- Color preview -->
      <div class="color-picker__preview">
        <div class="color-picker__preview-checkerboard" />
        <div class="color-picker__preview-color" :style="{ background: previewColor }" />
      </div>
    </div>

    <!-- Input fields -->
    <div class="color-picker__fields">
      <div class="color-picker__field color-picker__field--hex">
        <input
          class="color-picker__input"
          type="text"
          :value="hexInput"
          @input="onHexInput"
          maxlength="8"
          spellcheck="false"
        />
        <label class="color-picker__label">HEX</label>
      </div>
      <div
        v-for="ch in rgbChannels"
        :key="ch.key"
        class="color-picker__field"
      >
        <input
          class="color-picker__input"
          :value="rgba[ch.key]"
          @input="onRgbInput(ch.key, $event)"
          type="number"
          min="0"
          max="255"
        />
        <label class="color-picker__label">{{ ch.label }}</label>
      </div>
      <div class="color-picker__field">
        <input
          class="color-picker__input"
          :value="alphaInput"
          @input="onAlphaInput"
          type="number"
          min="0"
          max="1"
          step="0.01"
        />
        <label class="color-picker__label">A</label>
      </div>
    </div>

    <!-- Preset colors -->
    <div class="color-picker__presets">
      <div
        v-for="color in presetColors"
        :key="color"
        class="color-picker__preset"
        :class="{ 'color-picker__preset--transparent': color === 'transparent' }"
        :style="color !== 'transparent' ? { background: color } : {}"
        @click="applyPreset(color)"
      >
        <div v-if="color === 'transparent'" class="color-picker__preset-checker" />
      </div>
    </div>
  </div>
</template>

<script lang="ts" src="./ColorPicker.vue.ts"></script>

<style lang="less">
@import url('../../../styles/index');

.color-picker {
  position: relative;
  box-sizing: border-box;
  width: 220px;
  padding: 10px;
  font-family: Menlo, Consolas, 'Courier New', monospace;
  user-select: none;
  background: @bg-secondary;
  border-radius: @radius;
  box-shadow: 0 0 0 1px rgb(0 0 0 / 15%), 0 8px 16px rgb(0 0 0 / 15%);
}

/* Saturation/Brightness picker */
.color-picker__saturation {
  position: relative;
  width: 100%;
  padding-bottom: 75%;
  overflow: hidden;
  cursor: crosshair;
  border-radius: 2px;
}

.color-picker__saturation-white {
  position: absolute;
  inset: 0;
  background: linear-gradient(to right, #fff, rgb(255 255 255 / 0%));
}

.color-picker__saturation-black {
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, #000, rgb(0 0 0 / 0%));
}

.color-picker__saturation-pointer {
  position: absolute;
  cursor: move;
  transform: translate(-50%, -50%);
}

.color-picker__saturation-circle {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  box-shadow: 0 0 0 1.5px #fff, inset 0 0 1px 1px rgb(0 0 0 / 30%), 0 0 1px 2px rgb(0 0 0 / 40%);
}

/* Controls row */
.color-picker__controls {
  display: flex;
  align-items: center;
  margin-top: 8px;
}

.color-picker__sliders {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 4px;
}

/* Hue slider */
.color-picker__hue {
  position: relative;
  height: 10px;
  cursor: pointer;
  border-radius: 2px;
}

.color-picker__hue-gradient {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to right,
    #f00 0%,
    #ff0 17%,
    #0f0 33%,
    #0ff 50%,
    #00f 67%,
    #f0f 83%,
    #f00 100%
  );
  border-radius: 2px;
}

/* Alpha slider */
.color-picker__alpha {
  position: relative;
  height: 10px;
  overflow: hidden;
  cursor: pointer;
  border-radius: 2px;
}

.color-picker__alpha-checkerboard {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(45deg, #ccc 25%, transparent 25%),
    linear-gradient(-45deg, #ccc 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #ccc 75%),
    linear-gradient(-45deg, transparent 75%, #ccc 75%);
  background-position: 0 0, 0 3px, 3px -3px, -3px 0;
  background-size: 6px 6px;
}

.color-picker__alpha-gradient {
  position: absolute;
  inset: 0;
  border-radius: 2px;
}

/* Slider pointer (shared for hue and alpha) */
.color-picker__slider-pointer {
  position: absolute;
  top: 50%;
  width: 12px;
  height: 12px;
  cursor: pointer;
  background: #fff;
  border-radius: 50%;
  box-shadow: 0 1px 4px rgb(0 0 0 / 37%);
  transform: translate(-50%, -50%);
}

/* Color preview */
.color-picker__preview {
  position: relative;
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  margin-left: 8px;
  overflow: hidden;
  border-radius: 2px;
}

.color-picker__preview-checkerboard {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(45deg, #ccc 25%, transparent 25%),
    linear-gradient(-45deg, #ccc 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #ccc 75%),
    linear-gradient(-45deg, transparent 75%, #ccc 75%);
  background-position: 0 0, 0 4px, 4px -4px, -4px 0;
  background-size: 8px 8px;
}

.color-picker__preview-color {
  position: absolute;
  inset: 0;
  box-shadow: inset 0 0 0 1px rgb(0 0 0 / 15%);
}

/* Input fields */
.color-picker__fields {
  display: flex;
  gap: 3px;
  margin-top: 6px;
}

.color-picker__field {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;

  &--hex {
    flex: 1.6;
  }
}

.color-picker__fields .color-picker__input {
  box-sizing: border-box;
  width: 100%;
  height: 26px;
  padding: 1px 0;
  font-size: 11px;
  color: var(--color-text);
  text-align: center;
  background-color: @bg-primary;
  border: solid 1px var(--color-white);
  border-radius: 2px;

  &:hover {
    border-color: var(--color-white);
  }

  &:focus {
    color: var(--color-text);
    border-color: var(--color-white);
    box-shadow: none;
  }

  /* Hide number input arrows */
  &[type='number'] {
    appearance: textfield;

    &::-webkit-inner-spin-button,
    &::-webkit-outer-spin-button {
      margin: 0;
      appearance: none;
    }
  }
}

.color-picker__label {
  display: block;
  margin-top: 2px;
  font-size: 11px;
  color: var(--color-text-active);
  text-align: center;
  text-transform: uppercase;
}

/* Preset colors */
.color-picker__presets {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 4px;
  padding-top: 8px;
  margin-top: 6px;
  border-top: 1px solid @border;
}

.color-picker__preset {
  width: 100%;
  aspect-ratio: 1;
  overflow: hidden;
  cursor: pointer;
  border-radius: 3px;
  box-shadow: inset 0 0 0 1px rgb(0 0 0 / 15%);

  &:hover {
    box-shadow: inset 0 0 0 1px rgb(0 0 0 / 40%);
  }
}

.color-picker__preset-checker {
  width: 100%;
  height: 100%;
  background-image:
    linear-gradient(45deg, #ccc 25%, transparent 25%),
    linear-gradient(-45deg, #ccc 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #ccc 75%),
    linear-gradient(-45deg, transparent 75%, #ccc 75%);
  background-position: 0 0, 0 4px, 4px -4px, -4px 0;
  background-size: 8px 8px;
}
</style>
