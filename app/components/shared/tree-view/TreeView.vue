<template>
  <div ref="root" class="tree-view tree-view-root" @contextmenu.self="$emit('contextmenu', $event)" @dragover="onRootDragOver" @drop="onDrop">
    <div class="tree-view-nodes-list">
      <div v-for="node in visibleNodes" :key="node.pathStr" class="tree-view-node" :class="{ 'tree-view-selected': node.isSelected }">
        <div class="tree-view-cursor tree-view-cursor_before" />
        <div
          class="tree-view-node-item"
          :class="nodeClasses(node)"
          :data-tree-path="node.pathStr"
          :draggable="node.isDraggable"
          @mousedown="onNodeMouseDown(node, $event)"
          @mouseup="onNodeMouseUp(node, $event)"
          @dragstart="onDragStart(node, $event)"
          @dragover.prevent="onNodeDragOver(node, $event)"
          @dragend="stopDrag"
          @contextmenu="$emit('nodecontextmenu', node, $event)"
          @dblclick="$emit('nodedblclick', node, $event)"
          @click="$emit('nodeclick', node, $event)"
        >
          <div v-for="gap in node.level - 1" :key="gap" class="tree-view-gap" />
          <div class="tree-view-title">
            <span v-if="!node.isLeaf" class="tree-view-toggle" @mousedown.stop @click.stop="toggle(node, $event)">
              <slot name="toggle" :node="node">{{ node.isExpanded ? '-' : '+' }}</slot>
            </span>
            <slot name="title" :node="node">{{ node.title }}</slot>
          </div>
          <div class="tree-view-sidebar"><slot name="sidebar" :node="node" /></div>
        </div>
        <div class="tree-view-cursor tree-view-cursor_after" />
      </div>
    </div>
  </div>
</template>

<script lang="ts" src="./TreeView.vue.ts"></script>

<style lang="less">
@import url('../../../styles/index');

.tree-view {
  .radius();

  position: relative;
  flex-grow: 1;
  overflow: auto;
  color: var(--color-text);
  cursor: default;
  user-select: none;
  background-color: var(--color-bg-tertiary);
}

.tree-view-nodes-list {
  overflow: hidden;
}

.tree-view-node {
  position: relative;
}

.tree-view-node-item {
  position: relative;
  display: flex;
  align-items: center;
  min-height: @item-generic-size;
  padding: 0 12px;
  line-height: @item-generic-size;
  cursor: pointer;
  border: none;
  transition: background-color 80ms ease, box-shadow 80ms ease, opacity 80ms ease;

  &.tree-view-cursor-inside {
    background-color: var(--color-bg-active);
    box-shadow: inset 0 0 0 1px var(--color-white);
  }

  &.tree-view-dragging {
    opacity: 0.45;
  }
}

.tree-view-selected > .tree-view-node-item {
  color: var(--color-text-light);
  background-color: var(--color-bg-active);
}

.tree-view-title,
.tree-view-sidebar,
.title-container {
  display: flex;
  align-items: center;
}

.tree-view-title {
  flex-grow: 1;
  overflow: hidden;
}

.tree-view-sidebar {
  flex-shrink: 0;
  margin-left: auto;
}

.tree-view-gap {
  flex-shrink: 0;
  width: 24px;
  min-height: 1px;
}

.tree-view-toggle {
  display: inline-block;
  flex-shrink: 0;
  margin-right: 4px;

  i {
    display: block;
    width: 12px;
    font-size: 8px;
    color: var(--color-text);
    text-align: center;

    &.icon-right {
      transform: rotate(-90deg);
    }
  }
}

.tree-view-cursor {
  position: absolute;
  right: 0;
  left: calc(var(--depth) * 24px + 12px);
  z-index: 1;
  visibility: hidden;
  height: 1px;
  pointer-events: none;

  &::before {
    position: absolute;
    top: -1px;
    right: 12px;
    left: 0;
    height: 1px;
    content: '';
    background-color: var(--color-white);
  }

  &::after {
    position: absolute;
    top: -3px;
    left: -3px;
    width: 6px;
    height: 6px;
    content: '';
    background-color: var(--color-white);
    border: 1px solid var(--color-bg-tertiary);
    border-radius: 50%;
  }
}

.tree-view-cursor_before {
  top: 0;
}

.tree-view-cursor_after {
  bottom: 0;
}

.title-container {
  overflow: hidden;

  .tree-view-node-item:hover &,
  .tree-view-selected & {
    .transition();

    color: var(--color-text-light);
    opacity: 1;
  }
}

.item-title {
  .text-ellipsis();

  font-size: @font-size2;
}

.layer-icon {
  display: inline-block;
  flex-shrink: 0;
  width: 20px;
  margin-right: 4px;
  text-align: left;

  i {
    font-size: @font-size2;
    font-weight: @font-weight-bold;
  }
}
</style>
