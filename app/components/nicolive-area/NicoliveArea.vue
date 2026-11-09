<template>
  <div class="root">
    <button
      @click="onToggle"
      class="nicolive-area-toggle-button"
      :class="{ 'nicolive-area--opened': opened }"
      v-if="!isCompactMode"
    >
      <i class="icon-drop-down-arrow"></i>
    </button>
    <div class="nicolive-area-container" v-if="opened || isCompactMode">
      <div class="program-area" :class="{ isCreate: !hasProgram }">
        <template v-if="hasProgram">
          <program-info class="program-area-item" />
          <program-statistics class="program-area-item" />
          <comment-viewer class="comment-area" :showPlaceholder="showPlaceholder" />
          <tool-bar class="program-area-item" />
          <div class="footer performance-metrics" v-if="isCompactMode">
            <div class="flex flex--center flex--grow flex--justify-start">
              <performance-metrics />
            </div>
          </div>
        </template>
        <template v-else>
          <p class="message">
            <i class="icon-namaco"></i>
            このエリアではニコニコ生放送を<br />配信するための機能が利用できます
          </p>
          <div class="summary">
            <div class="summary-card">
              <template v-if="summary && summary.current">
                <div class="summary-label">{{ itemLabel(summary.current) }}</div>
                <div class="summary-title">{{ summary.current.title || t('untitled') }}</div>
                <div class="summary-time">{{ formatRange(summary.current) }}</div>
                <button
                  class="button button--primary summary-button"
                  @click="prepareProgram(summary.current.nicoliveProgramId)"
                  :disabled="isFetching"
                >
                  {{ t('fetchCurrent') }}
                </button>
              </template>
              <div class="summary-center" v-else>
                <button
                  class="button button--primary summary-button"
                  @click="createNewProgram"
                  :disabled="isFetching || isLoadingSummary"
                >
                  {{ t('create') }}
                </button>
              </div>
            </div>
            <div class="summary-card">
              <div class="summary-label">{{ t('reserved') }}</div>
              <template v-if="summary && summary.reserved">
                <div class="summary-title">{{ summary.reserved.title || t('untitled') }}</div>
                <div class="summary-time">{{ formatRange(summary.reserved) }}</div>
                <button
                  class="button button--primary summary-button"
                  @click="prepareProgram(summary.reserved.nicoliveProgramId)"
                  :disabled="isFetching"
                >
                  {{ t('fetchReserved') }}
                </button>
              </template>
              <div class="summary-center summary-none" v-else>{{ t('none') }}</div>
            </div>
          </div>
          <p class="summary-error" v-if="summaryError">{{ t('loadFailed') }}</p>
          <button
            class="refresh-button"
            :title="t('refresh')"
            @click="refreshSummary"
            :disabled="isLoadingSummary"
          >
            <i class="icon-reload"></i>
          </button>
        </template>
      </div>
    </div>
  </div>
</template>

<script lang="ts" src="./NicoliveArea.vue.ts"></script>
<style lang="less" scoped>
@import url('../../styles/index');

.root {
  display: flex;
  height: 100%;
}

.nicolive-area-toggle-button {
  .dividing-border(left);
  .dividing-border(right);

  width: 24px;
  background-color: var(--color-bg-primary);

  > i {
    display: block;
    font-size: @font-size2;
    color: var(--color-text);
    transform: rotate(90deg);
  }

  &:hover {
    > i {
      color: var(--color-text-light);
    }
  }

  &.nicolive-area--opened {
    > i {
      transform: rotate(-90deg);
    }
  }
}

.nicolive-area-container {
  display: flex;
  flex-grow: 1;
  flex-direction: column;
  align-items: center;
  width: @nicolive-area-width;
  background-color: var(--color-bg-quinary);
}

.program-area {
  display: flex;
  flex-grow: 1;
  flex-direction: column;
  justify-content: center;
  width: 100%;

  &.isCreate {
    align-items: center;
    padding: 16px;
  }
}

.message {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 24px;
  font-size: @font-size4;
  line-height: 24px;
  color: var(--color-text);
  text-align: center;

  i {
    margin-bottom: 16px;
    font-size: 88px;
    color: var(--color-text-dark);
  }
}

.program-area-item {
  flex-shrink: 0;
}

.summary {
  width: 100%;
  margin-bottom: 8px;
}

.summary-card {
  display: flex;
  flex-direction: column;
  min-height: 112px;
  padding: 8px 12px;
  margin-bottom: 8px;
  color: var(--color-text);
  background-color: var(--color-bg-secondary);
  border-radius: 4px;
}

.summary-center {
  display: flex;
  flex-grow: 1;
  align-items: center;
  justify-content: center;
}

.summary-none {
  color: var(--color-text-dark);
}

.summary-label {
  font-size: @font-size2;
  color: var(--color-text-dark);
}

.summary-title {
  font-weight: bold;
  word-break: break-all;
}

.summary-time {
  font-size: @font-size2;
}

.summary-button {
  align-self: center;
  min-width: 200px;
  margin-top: 8px;
}

.summary-center .summary-button {
  margin-top: 0;
}

.refresh-button {
  align-self: center;
  padding: 4px;
  margin-bottom: 80px;
  color: var(--color-text-dark);

  &:hover:not(:disabled) {
    color: var(--color-text-light);
  }

  &:disabled {
    opacity: 0.5;
  }
}

.summary-error {
  margin-bottom: 16px;
  font-size: @font-size2;
  color: var(--color-text-dark);
}

.comment-area {
  flex-grow: 1;
  flex-basis: 0;
}

.devider {
  display: flex;
  align-items: center;
  margin: 16px 0;

  .devider-label {
    padding: 0 8px;
    font-size: @font-size2;
    color: var(--color-text-dark);
  }

  &::before,
  &::after {
    flex-grow: 1;
    height: 1px;
    content: '';
    background-color: var(--color-text-dark);
  }
}

.footer {
  .dividing-border();

  position: relative;
  display: flex;
  flex: 0 0 auto;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  max-width: none;
  height: 32px;
  padding: 0 16px;
  background-color: var(--color-bg-secondary);
}
</style>
