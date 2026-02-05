# Decorators Status & Migration Strategy

このドキュメントでは、n-air-appで使用されているTypeScriptデコレータの現状と、将来のVue 3移行に向けた方針を整理します。

## 目次

- [Active Decorators (継続使用中)](#active-decorators-継続使用中)
  - [カスタム実装デコレータ](#カスタム実装デコレータn-air-app独自)
  - [vue-property-decorator](#vue-property-decorator-外部ライブラリ)
- [Removed Decorators (削除済み)](#removed-decorators-削除済み---commit-928797b3e)
- [TypeScript Configuration](#typescript-configuration)
- [Migration Recommendations](#migration-recommendations)

---

## Active Decorators (継続使用中)

### カスタム実装デコレータ（n-air-app独自）

#### 1. `@mutation()` 
**定義:** `app/services/core/stateful-service.ts`

- **用途:** StatefulServiceでのVuex mutation登録（100+ uses）
- **依存:** Vuex Store、TypeScript experimentalDecorators
- **reflect-metadata依存:** なし（prototype操作のみ）
- **実装概要:**
  - メソッドをVuex mutationとして登録
  - 開発モード時は安全性チェック（`this.state`のみアクセス可能）
  - プロキシパターンで不正アクセスを防止
- **Vue 3移行時の方針:**
  - **Vuex 4継続なら** → そのまま使用可能（実装に変更不要）
  - **Pinia移行なら** → 不要（Piniaは直接state変更可能）

**使用例:**
```typescript
@mutation()
setWindowPosition(position: IVec2) {
  this.state.windowPosition = position;
}
```

---

#### 2. `@Inject()`
**定義:** `app/services/core/injector.ts`

- **用途:** サービス依存性注入（~80 uses: components 50+, utils 30+）
- **依存:** カスタムInjector実装
- **reflect-metadata依存:** なし
- **代替手段:** `.instance`パターン（例: `NicoliveCommentSynthesizerService.instance`）
- **使用箇所:**
  - Vueコンポーネント（.vue.tsファイル）
  - ユーティリティクラス（Menu系、DragHandler等）
- **Vue 3移行時の方針:**
  - **クラススタイルコンポーネント継続なら** → そのまま使用可能
  - **Composition API移行なら** → `inject()`/`provide()`または`.instance`パターンに移行

**使用例:**
```typescript
// Before: @Inject()パターン
@Inject()
private nicoliveProgramService: NicoliveProgramService;

// After: .instanceパターン（代替手段）
private nicoliveProgramService = NicoliveProgramService.instance;
```

---

#### 3. `@ServiceHelper()`
**定義:** `app/services/core/service-helper.ts`

- **用途:** ヘルパークラスのメタデータ登録（7 uses）
- **依存:** カスタム実装
- **reflect-metadata依存:** なし
- **使用クラス:**
  - `Selection` (selection/selection.ts)
  - `Source` (sources/source.ts)
  - `Scene` (scenes/scene.ts)
  - `SceneItem` (scenes/scene-item.ts)
  - `SceneFolder` (scenes/scene-folder.ts)
  - `Binding` (hotkeys.ts)
  - `AudioSource` (audio/audio.ts)
- **Vue 3移行時の方針:** そのまま使用可能（Vue非依存）

---

#### 4. `@shortcut(key)`
**定義:** `app/services/hotkeys.ts`

- **用途:** キーボードショートカット登録（7 uses）
- **依存:** HotkeysService
- **reflect-metadata依存:** なし
- **使用箇所:**
  - SelectionService: `Delete`, `ArrowLeft/Right/Up/Down`
  - ClipboardService: `Ctrl+C`, `Ctrl+V`
- **Vue 3移行時の方針:** そのまま使用可能（Vue非依存）

**使用例:**
```typescript
@shortcut('Delete')
removeSelected() {
  // ...
}
```

---

### vue-property-decorator (外部ライブラリ)

#### 5. `@Component(options)`
**提供元:** vue-class-component（vue-property-decoratorから再エクスポート）

- **用途:** Vueコンポーネント定義（100+ uses）
- **依存:** vue-class-component 7.2.6、vue-property-decorator 7.3.0
- **Vue 3移行時の方針:**
  - **オプション1:** vue-class-component 8.x（Vue 3互換版）へ移行
  - **オプション2:** Composition API (`<script setup>`) へ全面移行

---

#### 6. `@Prop(options)`
**提供元:** vue-property-decorator

- **用途:** コンポーネントprops定義（30+ uses）
- **依存:** vue-property-decorator 7.3.0
- **Vue 3移行時の方針:**
  - **オプション1:** vue-facing-decorator等のVue 3互換ライブラリへ移行
  - **オプション2:** `defineProps()` (Composition API) へ移行

**使用例:**
```typescript
@Prop({ type: String, required: true }) 
collectionId: string;

@Prop({ type: Boolean, default: false }) 
disabled: boolean;
```

---

#### 7. `@Watch(propertyName)`
**提供元:** vue-property-decorator

- **用途:** リアクティブwatch定義（20+ uses）
- **依存:** vue-property-decorator 7.3.0
- **Vue 3移行時の方針:**
  - **オプション1:** vue-facing-decorator等のVue 3互換ライブラリへ移行
  - **オプション2:** `watch()` (Composition API) へ移行

**使用例:**
```typescript
@Watch('useOneComme')
async onUseOneCommeChanged() {
  // リアクティブな値の変更を監視
}
```

---

## Removed Decorators (削除済み - commit 928797b3e)

以下のデコレータはコードベースから削除されました。

### 1. `@InheritMutations`
**元の定義:** `app/services/core/stateful-service.ts`

- **削除理由:** 実装されていたが使用箇所が0件で、コメントアウトされた状態で長期間放置されていたため
- **元の用途:** 親クラスのmutationを子クラスに継承するためのデコレータ
- **削除内容:** デコレータ定義7行
- **影響範囲:** なし（使用箇所なし）

---

### 2. `@requiresLogin`
**元の定義:** `app/services/user.ts`

- **削除理由:** 実装されていたが使用箇所が0件で、コメントアウトされた状態で放置されていたため
- **元の用途:** メソッド実行前にログイン状態を確認するデコレータ
- **削除内容:** デコレータ定義20行
- **影響範囲:** なし（使用箇所なし）

---

### 3. `@Singleton`, `@InjectFromExternalApi`, `@Fallback`
**元の定義:** `app/services/api/external-api.ts`

- **削除理由:** 過去の設計で使用されていたが、現在は未使用。119行の大規模コメントブロックとして残っていたため削除
- **元の用途:** 
  - `@Singleton`: シングルトンパターンの強制
  - `@InjectFromExternalApi`: 外部API用の依存性注入
  - `@Fallback`: API呼び出し失敗時のフォールバック処理
- **削除内容:** 119行の大規模コメントブロック
- **影響範囲:** なし（現在のコードで使用されていない）

---

### 4. `@ExecuteInCurrentWindow`
**元のファイル:** `app/util/execute-in-current-window.ts`

- **削除理由:** 
  - `reflect-metadata` パッケージに依存していた
  - 使用箇所が0件で不要だった
  - reflect-metadata依存を排除するクリーンアップの一環として削除
- **元の用途:** メソッドを現在のウィンドウコンテキストで実行するためのデコレータ
- **削除内容:** ファイル全体削除
- **影響範囲:** なし（importしている箇所なし）

---

## TypeScript Configuration

現在のTypeScript設定（`tsconfig.json`）:

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,    // デコレータサポート必須
    "emitDecoratorMetadata": false     // reflect-metadata不要
  }
}
```

### 重要な点

- **すべてのアクティブなデコレータは `reflect-metadata` に依存していません**
- prototype操作とカスタムメタデータ管理のみで実装
- `experimentalDecorators: true` は必須（TypeScriptデコレータ構文を有効化）
- `emitDecoratorMetadata: false` で問題なし（メタデータAPIを使用しない）

---

## Migration Recommendations

### 短期（現行Vue 2.7）

**推奨:** 現状維持

- すべてのデコレータは正常に動作中
- reflect-metadata依存の削除により軽量化済み
- 必要に応じて `@Inject()` → `.instance` パターンへの移行は可能（任意）

**理由:**
- 安定稼働中のコードベースに大規模変更は不要
- Vue 3移行時に包括的に対応する方が効率的

---

### 中期（Vue 3移行時）

Vue 3移行プロジェクト開始時に以下を決定する必要があります:

#### 1. 状態管理ライブラリの選択

**オプションA: Vuex 4（Vue 3互換版）**
- ✅ `@mutation` デコレータをそのまま使用可能
- ✅ 既存コードの変更が最小限
- ⚠️ Vuexは公式推奨から外れつつある（Piniaが推奨）

**オプションB: Pinia（Vue 3公式推奨）**
- ✅ より軽量でシンプルなAPI
- ✅ TypeScript統合が優れている
- ⚠️ `@mutation` デコレータが不要になる（Piniaは直接state変更可能）
- ⚠️ StatefulServiceの実装を大幅に書き換える必要あり

#### 2. Vueコンポーネントスタイルの選択

**オプションA: Class-style Components継続**
- vue-class-component 8.x へ移行
- vue-facing-decorator などVue 3互換デコレータライブラリ採用
- ✅ 既存コードの構造を維持
- ⚠️ Composition APIがVue 3の主流

**オプションB: Composition API全面移行**
- `<script setup>` 構文へ移行
- `@Component/@Prop/@Watch` → `defineComponent/defineProps/watch` へ
- ✅ Vue 3のベストプラクティスに準拠
- ⚠️ 全コンポーネント（100+）の書き換えが必要

#### 3. カスタムデコレータの扱い

- **`@mutation`**: 状態管理ライブラリの選択に依存
- **`@Inject`**: 
  - Class-style継続なら使用可能
  - Composition APIなら `inject()/provide()` または `.instance` パターンへ
- **`@ServiceHelper`**: そのまま使用可能（Vue非依存）
- **`@shortcut`**: そのまま使用可能（Vue非依存）

---

### 推奨移行パス

Vue 3移行プロジェクトでは、以下の段階的アプローチを推奨:

**Phase 1: 依存関係のアップグレード（破壊的変更最小）**
1. Vue 3.x へアップグレード
2. Vuex 4 へアップグレード（`@mutation` 継続使用）
3. vue-class-component 8.x + vue-facing-decorator へ移行

**Phase 2: 段階的Composition API移行（任意）**
1. 新規コンポーネントはComposition API で作成
2. 既存コンポーネントは必要に応じて徐々に移行
3. `@Inject` は `.instance` パターンへ徐々に移行

**Phase 3: Pinia移行（任意）**
1. StatefulService を Pinia Stores へ書き換え
2. `@mutation` デコレータを削除
3. より軽量でモダンな状態管理へ

---

### vue-property-decorator完全削除パターン

vue-property-decoratorを削除する方法は2つあります:

#### パターンA: Options APIへ戻す（簡単、段階的移行可能）

Class-styleを維持しつつ、デコレータだけを削除してOptions APIの標準構文に戻す方法。

**Before: Class-style with Decorators**

```typescript
import { Component, Prop, Watch } from 'vue-property-decorator';
import { Inject } from 'services/core/injector';
import { SomeService } from 'services/some-service';
import Vue from 'vue';

@Component({
  components: { ChildComponent }
})
export default class MyComponent extends Vue {
  @Inject()
  private someService: SomeService;
  
  @Prop({ type: String, required: true })
  title: string;
  
  @Prop({ type: Boolean, default: false })
  disabled: boolean;
  
  localState = '';
  
  @Watch('title')
  onTitleChanged(newVal: string, oldVal: string) {
    console.log(`Title changed from ${oldVal} to ${newVal}`);
  }
  
  get computedValue() {
    return this.someService.getSomeData();
  }
  
  handleClick() {
    this.localState = 'clicked';
  }
  
  mounted() {
    this.someService.init();
  }
}
```

**After: Standard Vue Options API**

```typescript
import Vue from 'vue';
import { SomeService } from 'services/some-service';
import ChildComponent from './ChildComponent.vue';

export default Vue.extend({
  components: { ChildComponent },
  
  props: {
    title: { type: String, required: true },
    disabled: { type: Boolean, default: false }
  },
  
  data() {
    return {
      someService: SomeService.instance,
      localState: ''
    };
  },
  
  computed: {
    computedValue(): string {
      return this.someService.getSomeData();
    }
  },
  
  watch: {
    title(newVal: string, oldVal: string) {
      console.log(`Title changed from ${oldVal} to ${newVal}`);
    }
  },
  
  methods: {
    handleClick() {
      this.localState = 'clicked';
    }
  },
  
  mounted() {
    this.someService.init();
  }
});
```

**変換のポイント:**
- `@Component(options)` → `Vue.extend(options)`
- `@Prop` → `props:` オブジェクト
- `@Watch` → `watch:` オブジェクト
- `@Inject() service` → `data()` で `Service.instance` を返す
- クラスメソッド → `methods:` オブジェクト
- getter → `computed:` オブジェクト
- ライフサイクルメソッド → そのまま（名前同じ）

**メリット:**
- ✅ 変換が機械的で簡単
- ✅ Vue 2の標準構文（デコレータ不要）
- ✅ 既存のロジックをほぼそのまま移植可能
- ✅ TypeScript型推論も効く（`Vue.extend`使用のため）

**デメリット:**
- ⚠️ Vue 3移行時は結局Composition APIへの移行が必要
- ⚠️ クラス構文の恩恵（継承等）が失われる

---

#### パターンB: Composition API (`<script setup>`) へ移行（モダン、Vue 3準拠）

vue-property-decoratorを完全に削除し、Composition APIへ全面移行する場合のコード変換例:

**Before: Class-style Component with Decorators**

```typescript
import { Component, Prop, Watch } from 'vue-property-decorator';
import { Inject } from 'services/core/injector';
import { SomeService } from 'services/some-service';
import Vue from 'vue';

@Component({
  components: { ChildComponent }
})
export default class MyComponent extends Vue {
  @Inject()
  private someService: SomeService;
  
  @Prop({ type: String, required: true })
  title: string;
  
  @Prop({ type: Boolean, default: false })
  disabled: boolean;
  
  localState = '';
  
  @Watch('title')
  onTitleChanged(newVal: string, oldVal: string) {
    console.log(`Title changed from ${oldVal} to ${newVal}`);
  }
  
  get computedValue() {
    return this.someService.getSomeData();
  }
  
  handleClick() {
    this.localState = 'clicked';
  }
  
  mounted() {
    this.someService.init();
  }
}
```

#### After: Composition API with `<script setup>`

```typescript
import { ref, computed, watch, onMounted } from 'vue';
import { SomeService } from 'services/some-service';
import ChildComponent from './ChildComponent.vue';

// Props定義
interface Props {
  title: string;
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false
});

// Service取得（@Inject の代替）
const someService = SomeService.instance;

// ローカル状態
const localState = ref('');

// Computed（getter の代替）
const computedValue = computed(() => {
  return someService.getSomeData();
});

// Watch（@Watch の代替）
watch(() => props.title, (newVal, oldVal) => {
  console.log(`Title changed from ${oldVal} to ${newVal}`);
});

// Methods
const handleClick = () => {
  localState.value = 'clicked';
};

// Lifecycle（mounted の代替）
onMounted(() => {
  someService.init();
});
```

**変換のポイント:**

1. **`@Component` → `<script setup>`**
   - クラス定義が不要になる
   - `components`オプションは `<script setup>` 内でimportするだけで自動登録

2. **`@Prop` → `defineProps<T>()`**
   - 型安全なprops定義
   - `withDefaults()` でデフォルト値を設定

3. **`@Inject() service` → `Service.instance`**
   - シングルトンパターンで直接取得
   - または `inject<SomeService>('someService')` （provide/inject使用時）

4. **`@Watch` → `watch()`**
   - 関数的API
   - より柔軟な監視設定が可能（immediate, deep等）

5. **データプロパティ → `ref()` / `reactive()`**
   - プリミティブ値は `ref()`
   - オブジェクトは `reactive()` または `ref()`

6. **getter → `computed()`**
   - リアクティブな算出プロパティ

7. **ライフサイクルフック → `onXxx()`**
   - `mounted` → `onMounted()`
   - `beforeDestroy` → `onBeforeUnmount()`
   - 等

**メリット:**
- ✅ Vue 3のベストプラクティス
- ✅ より柔軟で再利用可能なコード
- ✅ Tree-shakingに優れる
- ✅ TypeScript統合が優れている

**デメリット:**
- ⚠️ 全コンポーネント（100+）の書き換えが必要
- ⚠️ `.value` アクセスなど学習コストあり

---

#### 削除可能な依存関係

**パターンA（Options API）の場合:**

Vue 2を継続する場合でもvue-property-decoratorは削除可能:

```json
// package.json から削除可能
{
  "dependencies": {
    "vue-property-decorator": "^7.3.0",  // 削除可能
    "vue-class-component": "^7.2.6"      // 削除可能
  }
}
```

**パターンB（Composition API）の場合:**

Composition API完全移行後に削除可能:

```json
// package.json から削除可能
{
  "dependencies": {
    "vue-property-decorator": "^7.3.0",  // 削除可能
    "vue-class-component": "^7.2.6"      // 削除可能
  }
}
```

**注意:** どちらのパターンでも、`@Component`, `@Prop`, `@Watch` を使用している全コンポーネント（100+）の変換が完了するまで削除しないこと。

---

#### 推奨アプローチ

**現在Vue 2.7を使用している場合:**
- **パターンA（Options API）** → 段階的に移行しやすい、Vue 2のまま実施可能
- 各コンポーネントを1つずつ変換可能
- デコレータ依存を減らしつつVue 2を継続使用

**Vue 3移行を計画している場合:**  
- **パターンB（Composition API）** → Vue 3のベストプラクティス
- Vue 3移行と同時に実施するのが効率的
- 将来性があり、モダンなコードになる

---

## 関連リソース

- [vue-class-component](https://github.com/vuejs/vue-class-component)
- [vue-property-decorator](https://github.com/kaorun343/vue-property-decorator)
- [vue-facing-decorator (Vue 3)](https://github.com/facing-dev/vue-facing-decorator)
- [Pinia - The Vue Store](https://pinia.vuejs.org/)
- [Vue 3 Migration Guide](https://v3-migration.vuejs.org/)

---

**Last Updated:** 2026-02-05  
**Related Commit:** 928797b3e (Removed unused decorators)
