<template>
  <modal-layout :show-cancel="false" :done-handler="done" :fixedSectionHeight="250" bare-content>
    <template #fixed><display :sourceId="sourceId" /></template>

    <template #content>
      <div class="container" data-test="SourceFilters">
        <div class="controls">
          <i class="icon-add icon-btn" @click="addFilter" data-test="Add"></i>
          <i
            class="icon-delete icon-btn"
            v-if="selectedFilterName"
            @click="removeFilter"
            data-test="Remove"
          ></i>
        </div>

        <tree-view
          :value="nodes"
          ref="slVueTree"
          @select="makeActive"
          @drop="handleSort"
          :allowMultiselect="false"
        >
          <template #title="{ node }">
            <div class="title-container">
              <span class="layer-icon">
                <i
                  @click="toggleVisibility(node.title)"
                  class="icon-unhide"
                  v-if="node.data.visible"
                ></i>
                <i
                  @click="toggleVisibility(node.title)"
                  class="icon-hide"
                  v-if="!node.data.visible"
                ></i>
              </span>
              &nbsp;
              <span class="item-title" :data-test="node.title">{{ node.title }}</span>
            </div>
          </template>
        </tree-view>

        <div class="content">
          <div v-if="selectedFilterName">
            <GenericForm :value="properties" @input="onPropertiesInput" :key="selectedFilterName"></GenericForm>
          </div>
          <div v-if="!selectedFilterName">
            {{ $t('filters.noFilterMessage') }}
          </div>
        </div>
      </div>
    </template>
  </modal-layout>
</template>

<script lang="ts" src="./SourceFilters.vue.ts"></script>

<style lang="less" scoped>
.content {
  flex-grow: 1;
  padding: 16px;
  overflow: auto;
}

.container {
  display: flex;
  align-content: stretch;
  align-items: stretch;
  height: 100%;
}

.controls {
  height: 48px;
  padding: 16px;
}
</style>
