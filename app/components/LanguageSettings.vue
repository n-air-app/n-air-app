<template>
  <toc-section :title="$t('common.language')">
    <div class="section">
      <div class="section-content">
        <GenericForm :value="settings" @input="save"></GenericForm>
      </div>
    </div>
  </toc-section>
</template>

<script lang="ts" src="./LanguageSettings.vue.ts"></script>
