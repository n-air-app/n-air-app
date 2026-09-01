<template>
  <div class="source-selector" data-test="SourceSelector">
    <div class="studio-controls-top">
      <h4 class="studio-controls__label" v-tooltip.bottom="sourcesTooltip">
        {{ $t('common.sources') }}
      </h4>
      <div class="studio-controls-top-sidebar">
        <i
          class="icon-folder icon-btn"
          @click="addFolder"
          v-tooltip.bottom="addGroupTooltip"
          data-test="AddFolder"
        />
        <i
          class="icon-add icon-btn"
          @click="addSource"
          v-tooltip.bottom="addSourceTooltip"
          data-test="Add"
        />
      </div>
    </div>

    <tree-view
      :value="nodes"
      @select="makeActive"
      @drop="handleSort"
      @toggle="toggleFolder"
      @contextmenu="showContextMenu()"
      @nodecontextmenu="showContextMenuForNode"
      @nodedblclick="sourcePropertiesForNode"
      :scrollAreaHeight="50"
      :maxScrollSpeed="15"
    >
      <template #title="{ node }">
        <div class="title-container">
          <span class="layer-icon">
            <i :class="determineIcon(node.isLeaf, node.data.sourceId)"></i>
          </span>
          <span class="item-title" :data-test="node.title">{{ node.title }}</span>
        </div>
      </template>

      <template #toggle="{ node }">
        <span v-if="!node.isLeaf && node.children.length">
          <i v-if="node.isExpanded" class="icon-drop-down-arrow" />
          <i v-if="!node.isExpanded" class="icon-drop-down-arrow icon-right" />
        </span>
      </template>

      <template #sidebar="{ node }">
        <template v-if="canShowActions(node.data.id)">
          <template v-if="!narrowSidebar">
            <i
              class="source-selector-action"
              :class="lockClassesForSource(node.data.id)"
              v-tooltip.bottom="lockTooltipForSource(node.data.id, node.isLeaf)"
              @click.stop="toggleLock(node.data.id)"
              @dblclick.stop
            />
            <i
              class="source-selector-action"
              :class="visibilityClassesForSource(node.data.id)"
              v-tooltip.bottom="visibilityTooltip"
              @click.stop="toggleVisibility(node.data.id)"
              @dblclick.stop
            />
            <i
              class="source-selector-action icon-delete"
              @click="removeItems"
              v-tooltip.bottom="removeSourcesTooltip"
              :data-test="`Remove` + node.title"
            />
            <i
              class="source-selector-action icon-settings"
              @click="sourceProperties"
              v-tooltip.bottom="openSourcePropertiesTooltip"
              data-test="Edit"
            />
          </template>
          <template v-else>
            <popper placement="bottom-end" class="source-actions-popper">
              <div class="popper source-actions-menu">
                <ul class="popup-menu-list">
                  <li class="popup-menu-item">
                    <button
                      class="source-actions-menu__item"
                      @click.stop="toggleLock(node.data.id)"
                    >
                      <i :class="lockClassesForSource(node.data.id)" />
                      {{ lockClassesForSource(node.data.id)['icon-lock'] ? $t('scenes.unlockLabel') : $t('scenes.lockLabel') }}
                    </button>
                  </li>
                  <li class="popup-menu-item">
                    <button
                      class="source-actions-menu__item"
                      @click.stop="toggleVisibility(node.data.id)"
                    >
                      <i :class="visibilityClassesForSource(node.data.id)" />
                      {{ $t('scenes.visibilityLabel') }}
                    </button>
                  </li>
                  <li class="popup-menu-item">
                    <button
                      class="source-actions-menu__item"
                      @click.stop="removeItems"
                    >
                      <i class="icon-delete" />
                      {{ $t('scenes.removeLabel') }}
                    </button>
                  </li>
                  <li class="popup-menu-item">
                    <button
                      class="source-actions-menu__item"
                      @click.stop="sourceProperties"
                    >
                      <i class="icon-settings" />
                      {{ $t('scenes.propertiesLabel') }}
                    </button>
                  </li>
                </ul>
              </div>
              <template #reference>
                <i class="source-selector-action source-selector-action--more icon-ellipsis-vertical" @click.stop @dblclick.stop />
              </template>
            </popper>
          </template>
        </template>
      </template>
    </tree-view>
  </div>
</template>

<script lang="ts" src="./SourceSelector.vue.ts"></script>

<style lang="less">
@import url('../../styles/index');

.studio-controls-top-sidebar {
  display: flex;
  flex-shrink: 0;
  align-items: center;
}

.source-selector-action--more {
  cursor: pointer;
  opacity: 1;
}

.source-actions-menu {
  min-width: 140px;
}

.source-actions-menu__item {
  display: flex;
  gap: 8px;
  align-items: center;
  width: 100%;
  padding: 6px 12px;
  font-size: @font-size2;
  color: var(--color-text);
  text-align: left;
  white-space: nowrap;
  cursor: pointer;

  i {
    flex-shrink: 0;
    width: 16px;
    text-align: center;
  }

  &:hover {
    color: var(--color-text-light);
    background-color: var(--color-bg-active);
  }
}

.source-selector-action {
  display: inline-block;
  width: 16px;
  margin-left: 8px;
  color: var(--color-text);
  text-align: center;
  opacity: @opacity-disabled;

  .tree-view-node-item:hover & {
    .transition();

    color: var(--color-text-light);
    opacity: 1;
  }

  &.keep-on {
    color: var(--color-text-light);
    opacity: 1;

    .tree-view-node-item:hover & {
      color: var(--color-text-light);
      opacity: 1;
    }
  }
}

//Simple Mode
.advanced-theme {
  .icon-folder {
    display: inline-block;
  }
}

.beginner-theme {
  .icon-folder {
    display: none;
  }
}
</style>
