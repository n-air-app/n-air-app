<template>
  <div class="setting-section">
    <div class="input-container">
      <div class="section">
        <div class="input-wrapper">
          <div class="row">
            <div class="name">{{ $t('settings.substream.use') }}</div>
            <div class="value">
              <input type="checkbox" v-model="use" class="toggle-button" />
            </div>
          </div>
        </div>
      </div>

      <div v-if="!use" class="description-text">
        {{ $t('settings.substream.description') }}
      </div>

      <div class="section" v-if="use">
        <div class="input-wrapper">
          <div class="input-label">
            <label>{{ $t('settings.substream.service') }}</label>
          </div>
          <dropdown
            :value="tabOptions.find(o => o.id === selectedTab)"
            :options="tabOptions"
            label="name"
            track-by="id"
            @input="selectedTab = $event.id"
          />
        </div>

        <div class="input-wrapper">
          <div class="input-label input-label--row">
            <label>{{ $t('settings.substream.url') }}</label>
            <span
              v-if="selectedTab !== 'other'"
              class="label-hint label-hint--clickable"
              @click="setDefaultUrl()"
            >
              {{ defaultServers[selectedTab].url }}
            </span>
          </div>
          <input type="text" v-model="url" />
        </div>

        <div class="input-wrapper">
          <div class="input-label input-label--row">
            <label>{{ $t('settings.substream.streamKey') }}</label>
            <button
              v-if="selectedTab !== 'other'"
              class="get-stream-key-button basic-button"
              data-size="sm"
              data-radius="sm"
              data-color="secondary"
              data-variant="light"
              @click="openExternalLink(defaultServers[selectedTab].stream_key_link)"
            >
              {{ $t('settings.substream.getStreamKey')
              }}<i class="icon-open-blank set-url-icon"></i>
            </button>
          </div>
          <div class="key-input-wrapper">
            <input :type="showKey ? 'text' : 'password'" v-model="key" />
            <button
              class="toggle-key-button basic-button"
              style="margin: 0"
              data-size="sm"
              data-radius="sm"
              data-color="secondary"
              data-variant="light"
              @click="toggleShowKey()"
            >
              {{ showKey ? $t('settings.substream.display') : $t('settings.substream.show') }}
            </button>
            <button
              class="toggle-key-button basic-button"
              style="margin: 0"
              data-size="sm"
              data-radius="sm"
              data-color="secondary"
              data-variant="light"
              @click="pasteKey()"
            >
              {{ $t('common.paste') }}
            </button>
          </div>
        </div>
      </div>

      <div class="section" v-if="use">
        <div class="input-wrapper">
          <div class="row">
            <div class="name">{{ $t('settings.substream.syncWithMainStream') }}</div>
            <div class="value">
              <input type="checkbox" v-model="sync" class="toggle-button" />
            </div>
          </div>
        </div>
        <div class="input-wrapper">
          <div class="action-buttons">
            <button
              class="control-button basic-button"
              data-size="md"
              data-radius="sm"
              data-color="secondary"
              data-variant="light"
              @click="start()"
            >
              {{ $t('settings.substream.start') }}
            </button>
            <button
              class="control-button basic-button"
              data-size="md"
              data-radius="sm"
              data-color="secondary"
              data-variant="light"
              @click="stop()"
            >
              {{ $t('settings.substream.stop') }}
            </button>
          </div>
        </div>

        <div style="white-space: pre-wrap">{{ status }}</div>
      </div>

      <div class="section" v-if="use">
        <div
          class="section-title section-title--dropdown"
          :class="{ 'section-title--opened': !collapsed }"
          @click="toggleCollapsed()"
        >
          <h4>
            <i v-if="collapsed === true" class="icon-plus section-title__icon" />
            <i v-if="collapsed === false" class="icon-minus section-title__icon" />
            {{ $t('common.performance.streamQuality') }}
          </h4>
        </div>
        <div v-show="!collapsed">
          <div class="input-wrapper">
            <div class="input-label">
              <label>
                {{ $t('settings.substream.videoEncoder')
                }}<span class="label-description"
                >({{ $t('settings.substream.default') }}: x264)</span
                >
              </label>
            </div>
            <dropdown
              v-model="videoCodec"
              :options="videoCodecs"
              label="name"
              track-by="id"
            >
            </dropdown>
          </div>

          <div class="input-wrapper">
            <div class="input-label">
              <label>
                {{ $t('settings.substream.videoBitrate') }}
                <span class="label-description"
                >({{ $t('settings.substream.default') }}: 2500Kbps)</span
                ></label
              >
            </div>
            <input type="number" v-model="videoBitrate" min="200" max="100000" />
          </div>

          <div class="input-wrapper">
            <div class="input-label">
              <label>
                {{ $t('settings.substream.keyintSec') }}
                <span class="label-description">({{ $t('settings.substream.default') }}: 2)</span>
              </label>
            </div>
            <input type="number" v-model="keyintSec" min="0" max="20" />
          </div>

          <div class="input-wrapper">
            <div class="input-label">
              <label
              >{{ $t('settings.substream.audioEncoder')
              }}<span class="label-description"
              >({{ $t('settings.substream.default') }}: FFmpeg AAC)</span
              >
              </label>
            </div>
            <dropdown
              v-model="audioCodec"
              :options="audioCodecs"
              label="name"
              track-by="id"
            >
            </dropdown>
          </div>

          <div class="input-wrapper">
            <div class="input-label">
              <label
              >{{ $t('settings.substream.audioBitrate') }}
                <span class="label-description"
                >({{ $t('settings.substream.default') }}: 128Kbps)</span
                ></label
              >
              <input type="number" v-model="audioBitrate" min="64" max="320" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" src="./SubStreamSettings.vue.ts"></script>

<style lang="less" scoped>
@import url('../../styles/index');

.row {
  display: flex;
  flex-direction: row;
  align-items: center;
  width: 100%;
}

.name {
  flex-grow: 1;
  font-size: @font-size4;
  color: var(--color-text);
}

.value {
  display: flex;
  align-items: center;
  color: var(--color-text);
}

.input-label--row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.label-hint {
  font-size: @font-size3;
  color: var(--color-text-dark);
}

.label-hint--clickable {
  text-decoration: underline dotted;
  cursor: pointer;

  &:hover {
    color: var(--color-text-light);
  }
}

.get-stream-key-button {
  height: 20px;
  margin: 0 !important;
}

.label-description {
  margin-left: 16px;
  font-size: @font-size3;
  color: var(--color-text-dark);
}

.set-url-icon {
  margin-left: 4px;
}

.key-input-wrapper {
  display: flex;
  gap: 8px;
  align-items: center;
}

.toggle-key-button {
  width: 110px;
  height: 32px;
  margin: 0;
}

.action-buttons {
  display: flex;
  gap: 8px;
}

.control-button {
  margin: 0;
}

.description-text {
  margin: 16px;
  white-space: pre-line;
}
</style>
