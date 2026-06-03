<template>
  <div class="setting-section">
    <toc-section title="表示">
      <div class="section">
        <div class="input-label section-heading">
          <label>表示</label>
        </div>
        <div class="input-container">
          <div class="input-wrapper">
            <div class="row">
              <div class="name">匿名コメントを表示</div>
              <div class="value">
                <input type="checkbox" v-model="showAnonymous" class="toggle-button" />
              </div>
            </div>
          </div>
          <div class="input-wrapper">
            <div class="row">
              <div class="name">なふだを表示</div>
              <div class="value">
                <input type="checkbox" v-model="nameplateEnabled" class="toggle-button" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </toc-section>
    <toc-section title="わんコメ連携">
      <div class="section">
        <div class="input-label section-heading">
          <label>わんコメ連携</label>
        </div>
        <div class="input-container">
          <div class="input-wrapper">
            <div class="row">
              <div class="name">わんコメに自動で番組情報を反映する</div>
              <div class="value">
                <input type="checkbox" v-model="useOneComme" class="toggle-button" />
              </div>
            </div>
          </div>
          <div class="input-wrapper" v-if="useOneComme">
            <div class="row">
              <div class="name">番組作成時にわんコメに残っているコメントをクリアする</div>
              <div class="value">
                <input type="checkbox" v-model="removeComment" class="toggle-button" />
              </div>
            </div>
          </div>
          <div class="banner" data-type="error" v-if="isOneCommeError">
            <div class="banner-body">
              わんコメに接続できませんでした。わんコメを起動して確認してください
            </div>
          </div>
          <div class="onecomme-description">
            「わんコメ」とは、映像上にリスト形式でコメントを表示したり、コメントに応じて特別な演出を表示させたりといったことができるソフトウェアです。機能利用時のイメージやできることの詳細は
            <a @click="showOneCommeInfo()">公式ホームページ（外部サイト）</a>をご覧ください。
          </div>
        </div>
      </div>
    </toc-section>

    <toc-section title="HTTP連携">
      <div class="section">
        <div class="input-label section-heading">
          <label>HTTP連携</label>
        </div>
        <div class="input-container">
          <div class="input-wrapper">
            <div class="input-label">
              <label>Method</label>
            </div>
            <dropdown
              v-model="httpRelationMethod"
              :options="httpRelationMethods"
              label="text"
              track-by="value"
              data-variant="filled"
            >
            </dropdown>
          </div>

          <div class="input-wrapper" v-if="httpRelationMethod.value !== ''">
            <div class="input-label">
              <label>URL</label>
            </div>
            <input type="text" v-model="httpRelationUrl" />
          </div>
          <div
            class="input-wrapper"
            v-if="httpRelationMethod.value !== '' && httpRelationMethod.value !== 'GET'"
          >
            <div class="input-label">
              <label>Body</label>
            </div>
            <textarea rows="3" v-model="httpRelationBody"></textarea>
          </div>
          <div class="input-wrapper" v-if="httpRelationMethod.value !== ''">
            <button
              data-size="md"
              data-radius="sm"
              data-color="secondary"
              data-variant="light"
              class="basic-button"
              @click="testHttpRelation()"
            >
              テスト
            </button>
          </div>
          <div class="input-wrapper">
            詳細は<a @click="showHttpRelationPage()">こちら</a>を参照してください
          </div>
        </div>
      </div>
    </toc-section>
  </div>
</template>

<script lang="ts" src="./CommentSettings.vue.ts"></script>
<style lang="less" scoped>
@import url('../../styles/index');

.section-item {
  padding: 16px;
}

.row {
  display: flex;
  flex-direction: row;
  align-items: center;
  width: 100%;
}

.input-heading {
  margin-bottom: 16px;

  .button {
    margin-bottom: 0;
    margin-left: auto;
  }
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

.button {
  & + & {
    margin-left: 8px;
  }
}

.onecomme-description {
  width: 100%;
  font-size: @font-size3;
}
</style>
