<template>
  <div data-test="SceneSelector">
    <div class="studio-controls-top" v-if="!isCompactMode">
      <div class="scene-collections-wrapper">
        <popper class="scene-collections__dropdown" placement="bottom-start">
          <div class="popper scene-collections-menu">
            <div class="input-wrapper input-wrapper--search">
              <input
                class="input--search"
                type="text"
                :placeholder="$t('common.search')"
                v-model="searchQuery"
                @click.stop
              />
            </div>
            <a class="link settings-link" @click="manageCollections">
              <i class="icon-settings" />
            </a>
            <div
              v-for="sceneCollection in sceneCollections"
              :key="sceneCollection.id"
              class="scene-collections-menu__item"
              :class="{ active: activeId === sceneCollection.id }"
              @click="loadCollection(sceneCollection.id)"
            >
              {{ sceneCollection.name }}
            </div>
          </div>

          <button slot="reference" class="scene-collections__toggle">
            <span class="scene-name">{{ activeCollection.name }}</span
            ><i class="icon-drop-down-arrow" />
          </button>
        </popper>
      </div>

      <div class="studio-controls-top-sidebar">
        <i
          class="icon-add icon-btn"
          v-tooltip.bottom="addSceneTooltip"
          @click="addScene"
          data-test="Add"
        />
        <i
          class="icon-settings icon-btn"
          v-tooltip.bottom="openSceneSwitcherTooltip"
          @click="showTransitions"
          data-test="Edit"
        />
      </div>
    </div>

    <selector
      class="studio-controls-selector"
      :items="scenes"
      :activeItems="activeSceneId ? [activeSceneId] : []"
      @select="makeActive"
      @sort="handleSort"
      @contextmenu="showContextMenu"
    >
      <template slot="actions" slot-scope="p">
        <i
          class="icon-delete icon-btn"
          v-tooltip.bottom="removeSceneTooltip"
          @click="removeScene(p.item.value)"
          :data-test="'Remove' + p.item.name"
        />
      </template>
    </selector>

    <help-tip :dismissable-key="helpTipDismissable">
      <div slot="title" v-text="$t('scenes.sceneCollections')"></div>
      <div slot="content" v-text="$t('scenes.sceneCollectionSelectionDescription')"></div>
    </help-tip>
  </div>
</template>

<script lang="ts" src="./SceneSelector.vue.ts"></script>

<style lang="less" scoped>
@import url('../../styles/index');

.scene-collections-wrapper {
  position: relative;
  display: flex;
  flex-grow: 1;
  align-items: center;
  width: 160px;
  margin-right: 16px;
}

.input-wrapper--search {
  .radius();

  width: calc(100% - 38px); // .settings-link + 余白のサイズを引く
  margin: 8px;

  &::after {
    color: var(--color-text);
  }
}

.settings-link {
  position: absolute;
  top: 18px;
  right: 8px;
  display: inline-block;
}

.scene-collections__dropdown {
  .text-ellipsis();

  display: flex;
  width: 100%;
}

.scene-collections-menu {
  width: 100%;
  max-height: 152px;
  overflow-y: auto;
}

.scene-collections__toggle {
  display: flex;
  align-items: center;
  width: 100%;
  overflow: hidden;
  font-size: @font-size4;
  color: var(--color-text);
  text-align: left;
  letter-spacing: 0.7px;
  .semibold();

  i {
    margin-left: 8px;
    font-size: @font-size1;
    .icon-hover();
  }

  &:hover {
    i {
      color: var(--color-text-light);
    }
  }

  > .scene-name {
    .text-ellipsis();

    display: inline-block;
    font-size: @font-size4;
    color: var(--color-text-light);
  }
}

.scene-collections-menu__item {
  .text-ellipsis();

  width: 100%;
  padding: 0 8px;
  font-size: @font-size2;
  line-height: 32px;
  color: var(--color-text);
  text-align: left;
  cursor: pointer;

  &:hover,
  &.active {
    color: var(--color-text-light);
    background-color: var(--color-bg-active);
  }

  &:last-child,
  &:last-of-type {
    margin-bottom: 8px;
  }

  .settings-link + & {
    border-top: 1px solid var(--color-border-light);
  }
}
</style>
