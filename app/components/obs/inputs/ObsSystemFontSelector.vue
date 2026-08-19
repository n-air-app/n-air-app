<template>
  <div :data-test="testingAnchor">
    <div class="input-container">
      <div class="input-label">
        <label>{{ $t('settings.fontFamily') }}</label>
      </div>
      <div class="input-wrapper">
        <dropdown
          ref="family"
          class="dropdown--font"
          :value="selectedFamily"
          :options="fontFamilies"
          track-by="family"
          label="family"
          :searchable="true"
          @input="setFamily"
        >
          <template #option="props">
            <span :style="{ fontFamily: props.option.family }">
              {{ props.option.family }}
            </span>
          </template>
          <template #noResult>
            {{ $t('settings.itemNotFoundMessage') }}
          </template>
        </dropdown>
      </div>
    </div>
    <div class="input-container">
      <div class="input-label">
        <label>{{ $t('settings.fontStyle') }}</label>
      </div>
      <div class="input-wrapper">
        <dropdown
          ref="font"
          class="dropdown--font"
          :value="selectedFont"
          :options="selectedFamily.fonts"
          track-by="style"
          label="style"
          @input="setStyle"
        >
          <template #option="props">
            <span :style="styleForFont(props.option)">
              {{ props.option.style }}
            </span>
          </template>
          <template #noResult>
            {{ $t('settings.itemNotFoundMessage') }}
          </template>
        </dropdown>
      </div>
    </div>
    <font-size-selector :value="value.value?.size" @input="setSize" />
  </div>
</template>

<script lang="ts" src="./ObsSystemFontSelector.vue.ts"></script>

<style lang="less" scoped>
@import url('../../../styles/index');

.dropdown--font {
  margin-bottom: 0;
}

.FontProperty-presets {
  position: absolute;
  top: 0;
  right: 0;
  width: 0;
  cursor: pointer;
  outline: none;
  background-color: rgba(0, 0, 0, 0%);
  border: 0;
}
</style>
