<template>
  <div :data-test="testingAnchor" class="google-font-selector">
    <div>
      <div class="input-container">
        <div class="input-label">
          <label>
            {{ $t('settings.fontFamily') }}
            <i v-if="isLoading" class="icon-spinner icon-spin google-font-loading" />
          </label>
        </div>
        <div class="input-wrapper">
          <dropdown
            :value="selectedFamily"
            :options="fontFamilies"
            :disabled="isLoading"
            @input="setFamily"
          >
          </dropdown>
        </div>
      </div>
      <div class="input-container">
        <div class="input-label">
          <label>
            {{ $t('settings.fontStyle') }}
            <i v-if="isLoading" class="icon-spinner icon-spin google-font-loading" />
          </label>
        </div>
        <div class="input-wrapper">
          <dropdown
            :value="selectedStyle"
            :options="fontStyles"
            :disabled="isLoading"
            @input="setStyle"
          >
          </dropdown>
          <template slot="noResult">
            {{ $t('settings.itemNotFoundMessage') }}
          </template>
        </div>
      </div>
      <font-size-selector :value="value.size" @input="setSize" />
    </div>
  </div>
</template>

<script lang="ts" src="./ObsGoogleFontSelector.vue.ts"></script>

<style lang="less" scoped>
.google-font-loading {
  margin-left: 5px;
}

.icon-spin {
  animation: icon-spin 2s infinite linear;
}

@keyframes icon-spin {
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(359deg);
  }
}
</style>
