<template>
  <div class="tool-bar">
    <div class="reservation-timer" v-if="programStatus === 'reserved'">
      番組開始まで {{ format(-programCurrentTime) }}
    </div>
    <div class="elapsed-time" v-else>
      <div class="program-time">
        <time>{{ format(programCurrentTime) }}</time> /
        <time>{{ format(programTotalTime) }}</time>
      </div>
    </div>

    <div class="side-bar">
      <popper
        placement="bottom-end"
        width="240px"
        @show="showPopupMenu = true"
        @hide="showPopupMenu = false"
      >
        <div class="popper">
          <ul class="popup-menu-list">
            <li class="popup-menu-item">
              <div class="toggle-item">
                <span class="toggle-label">自動延長</span
                ><input
                  type="checkbox"
                  :checked="autoExtensionEnabled"
                  @click="toggleAutoExtension()"
                  class="toggle-button"
                />
              </div>
            </li>
            <li class="popup-menu-item">
              <button
                class="manual-extension link"
                @click="extendProgram()"
                :disabled="
                  autoExtensionEnabled ||
                    isExtending ||
                    !isProgramExtendable ||
                    programStatus === 'reserved'
                "
              >
                30分延長
              </button>
            </li>
          </ul>
        </div>
        <template #reference>
          <button
            class="button--circle button--secondary button--extension"
            v-tooltip.bottom="extensionTooltip"
            :class="{ 'is-show': showPopupMenu, active: autoExtensionEnabled }"
          >
            <i class="icon-extension"></i>
          </button>
        </template>
      </popper>

      <button
        @click="fetchProgram"
        :disabled="isFetching"
        v-tooltip.bottom="fetchTooltip"
        class="button--circle button--secondary"
      >
        <i class="icon-reload"></i>
      </button>

      <div class="program-button">
        <button
          v-if="selectedButton === 'release'"
          @click="releaseProgram"
          class="button button--secondary"
        >
          戻る
        </button>
        <button
          v-else-if="selectedButton === 'end'"
          @click="endProgram"
          :disabled="isEnding || programStatus === 'reserved'"
          class="button button--end-program button--live"
        >
          番組終了
        </button>
        <button
          v-else-if="selectedButton === 'create'"
          @click="createProgram"
          class="button button--primary"
        >
          番組作成
        </button>
        <button
          v-else
          @click="startProgram"
          :disabled="isStarting"
          class="button button--action"
        >
          番組開始
        </button>
        <popper
          placement="bottom-end"
          width="240px"
          @show="showButtonSelector = true"
          @hide="showButtonSelector = false"
        >
          <div class="popper">
            <ul class="popup-menu-list">
              <li class="item" v-for="option in dropdownOptions" :key="option.key">
                <button
                  :class="{
                    'button-selector': true,
                    current: selectedButton === option.key,
                  }"
                  @click="selectButton(option.key)"
                >
                  <span class="item-name">{{ option.name }}</span>
                  <span class="item-text">{{ option.description }}</span>
                </button>
              </li>
            </ul>
          </div>
          <template #reference>
            <button
              class="button button--select-menu"
              v-tooltip.bottom="startButtonSelectorTooltip"
              v-show="programStatus !== 'onAir'"
              :class="{
                'is-show': showPopupMenu,
                active: showButtonSelector,
                'button--action': selectedButton === 'start',
                'button--end-program button--live': selectedButton === 'end',
                'button--primary': selectedButton === 'create',
                'button--secondary': selectedButton === 'release',
              }"
            >
              <i class="icon-drop-down-arrow"></i>
            </button>
          </template>
        </popper>
      </div>
    </div>
  </div>
</template>
<script lang="ts" src="./ToolBar.vue.ts"></script>
<style lang="less" scoped>
@import url("../../styles/index");

.tool-bar {
  position: relative;
  display: flex;
  align-items: center;
  height: 64px;
  padding: 0 16px;
  background-color: var(--color-bg-quinary);
}

.elapsed-time {
  display: flex;
  align-items: center;
}

.program-time,
.reservation-timer {
  .time-styling();
}

.side-bar {
  display: flex;
  align-items: center;
  margin-left: auto;
}

.toggle-button {
  margin-left: auto;
}

.auto-extension {
  z-index: 2;
  padding-left: 16px;
  margin-left: auto;
}

.button--circle {
  margin-left: 16px;
}

.button--extension {
  i {
    margin-bottom: 1px;
    margin-left: 2px;
  }
}

.button-selector {
  display: flex;
  flex-direction: column;
  width: 100%;
  padding: 8px 16px;

  .item-name {
    font-size: @font-size4;
    line-height: 1.6;
    color: var(--color-text-light);
  }

  .item-text {
    margin: 0;
    font-size: @font-size2;
    line-height: 1.6;
    color: var(--color-text);
  }

  &.current,
  &:hover {
    .bg-hover();
  }
}

.program-button {
  display: flex;
  width: 120px;
  margin-left: 16px;
  overflow: hidden;
  .radius();

  .button {
    border-radius: 0;

    &:first-child {
      flex-grow: 1;
    }
  }
}

.button--select-menu {
  height: 100%;
  padding: 0 12px;
  border-width: 0 0 0 1px;
  border-left-color: var(--color-button-label);
  border-left-width: 1px;
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;

  i {
    margin: 0;
    font-size: @font-size1;
  }
}
</style>
