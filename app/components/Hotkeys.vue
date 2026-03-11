<template>
  <div>
    <toc-section :title="$t('common.basic')">
      <hotkey-group :title="$t('common.basic')" :hotkeys="hotkeySet.general" />
    </toc-section>
    <toc-section v-if="Object.keys(hotkeySet.scenes).length > 0" :title="$t('common.scenes')">
      <toc-section
        v-for="(scenesHotkeys, sceneId) in hotkeySet.scenes"
        :key="sceneId"
        :title="getSceneName(sceneId)"
      >
        <hotkey-group
          :title="getSceneName(sceneId)"
          :hotkeys="scenesHotkeys"
        />
      </toc-section>
    </toc-section>
    <toc-section v-if="Object.keys(hotkeySet.sources).length > 0" :title="$t('common.sources')">
      <toc-section
        v-for="(sourceHotkeys, sourceId) in hotkeySet.sources"
        :key="sourceId"
        :title="getSourceName(sourceId)"
      >
        <hotkey-group
          :title="getSourceName(sourceId)"
          :hotkeys="sourceHotkeys"
        />
      </toc-section>
    </toc-section>
  </div>
</template>

<script lang="ts" src="./Hotkeys.vue.ts"></script>
