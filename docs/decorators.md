# Decorators Status (Vue 3 Migration Complete)

このドキュメントでは、Vue 3移行完了後のn-air-appにおけるTypeScriptデコレータの現状を整理します。

## 目次

- [Active Decorators (継続使用中)](#active-decorators-継続使用中)
- [Removed by Vue 3 Migration (移行で撤去)](#removed-by-vue-3-migration-移行で撤去)
- [Previously Removed Decorators (それ以前に削除済み)](#previously-removed-decorators-それ以前に削除済み)
- [TypeScript Configuration](#typescript-configuration)
- [Component Style (Vue 3移行後)](#component-style-vue-3移行後)

---

## Active Decorators (継続使用中)

以下のデコレータはVue 3移行後も正常動作しています（Vue非依存またはVue3対応済み）。

### 1. `@mutation()`
**定義:** `app/services/core/stateful-service.ts`

- **用途:** StatefulServiceでのVuex 4 mutation登録（51ファイルで使用）
- **状態:** Vuex 4で継続使用中。実装変更不要。
- **depend:** TypeScript experimentalDecorators（reflect-metadata不要）

**使用例:**
```typescript
@mutation()
setWindowPosition(position: IVec2) {
  this.state.windowPosition = position;
}
```

---

### 2. `@Inject()`
**定義:** `app/services/core/injector.ts`

- **用途:** サービス間の依存性注入（services層: 多数使用中）
- **状態:** サービス層では継続使用中
- **注意:** Vueコンポーネントでの `@Inject()` 使用は **Vue 3移行で0件に撤去済み**。コンポーネントは `ServiceName.instance()` パターンを使用。

**サービス間では引き続き有効:**
```typescript
// services層での使用（現在も有効）
class SomeService extends Service {
  @Inject()
  private otherService: OtherService;
}
```

**コンポーネントでの代替（移行済みパターン）:**
```typescript
// コンポーネントはこちらを使用
export default defineComponent({
  computed: {
    someData() {
      return SomeService.instance().getData();
    }
  }
});
```

---

### 3. `@ServiceHelper()`
**定義:** `app/services/core/service-helper.ts`

- **用途:** ヘルパークラスのメタデータ登録（7ファイルで使用）
- **使用クラス:** `Selection`, `Source`, `Scene`, `SceneItem`, `SceneFolder`, `Binding`, `AudioSource`
- **状態:** Vue非依存のためそのまま継続使用中

---

### 4. `@shortcut(key)`
**定義:** `app/services/hotkeys.ts`

- **用途:** キーボードショートカット登録（2ファイルで使用）
- **使用箇所:** SelectionService (`Delete`, `ArrowLeft/Right/Up/Down`)、ClipboardService (`Ctrl+C`, `Ctrl+V`)
- **状態:** Vue非依存のためそのまま継続使用中

---

### 5. `@InitAfter('ServiceName')`
**定義:** `app/services/core/service-initialization-observer.ts`

- **用途:** サービス初期化順序の制御（10ファイルで使用）
- **状態:** Vue非依存のためそのまま継続使用中
- **注意:** 対象サービスは `app/app-services.ts` に登録が必要（登録漏れで `initObservers` が動作しない）

---

## Removed by Vue 3 Migration (移行で撤去)

以下はVue 3移行（PR1296）で撤去されました。

### `vue-property-decorator` / `vue-class-component` 関連

| デコレータ | 元の用途 | 移行後 |
|---|---|---|
| `@Component(options)` | Vueコンポーネント定義（100+件） | `defineComponent(options)` |
| `@Prop(options)` | props定義（30+件） | `props:` オブジェクト |
| `@Watch(propertyName)` | リアクティブwatch（20+件） | `watch:` オブジェクト |
| `@Inject()` (コンポーネント) | サービス注入（50+件） | `ServiceName.instance()` |

パッケージも削除済み:
- `vue-property-decorator` (7.3.0) → 削除
- `vue-class-component` (7.2.6) → 削除

---

## Previously Removed Decorators (それ以前に削除済み)

commit 928797b3e で削除:

| デコレータ | 理由 |
|---|---|
| `@InheritMutations` | 使用箇所0件 |
| `@requiresLogin` | 使用箇所0件 |
| `@Singleton`, `@InjectFromExternalApi`, `@Fallback` | 使用箇所0件（119行の大規模コメントブロック） |
| `@ExecuteInCurrentWindow` | reflect-metadata依存、使用箇所0件 |

---

## TypeScript Configuration

現在のTypeScript設定（`tsconfig.json`）:

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,    // 継続使用中のデコレータに必須
    "emitDecoratorMetadata": false     // reflect-metadata不要
  }
}
```

**すべてのアクティブなデコレータは `reflect-metadata` に依存していません。**

---

## Component Style (Vue 3移行後)

Vue 3移行後のコンポーネントの標準スタイルは **`defineComponent` + Options API + `Service.instance()`** です。

### 現在の標準パターン

```typescript
import { defineComponent } from 'vue';
import { SomeService } from 'services/some-service';

export default defineComponent({
  name: 'MyComponent',
  components: { ChildComponent },

  props: {
    title: { type: String, required: true as const },
    disabled: { type: Boolean, default: false },
  },

  data() {
    return {
      localState: '',
    };
  },

  computed: {
    computedValue(): string {
      return SomeService.instance().getSomeData();
    },
  },

  watch: {
    title(newVal: string, oldVal: string) {
      console.log(`Title changed from ${oldVal} to ${newVal}`);
    },
  },

  methods: {
    handleClick() {
      this.localState = 'clicked';
    },
  },

  mounted() {
    SomeService.instance().init();
  },

  beforeUnmount() {
    // cleanup
  },
});
```

### Vue 2との主な変更点

| Vue 2 | Vue 3 |
|---|---|
| `Vue.extend({})` / クラス + `@Component` | `defineComponent({})` |
| `@Inject() service` | `SomeService.instance()` を直接呼び出し |
| `@Prop` / `@Watch` | `props:` / `watch:` オプション |
| `beforeDestroy` | `beforeUnmount` |
| `destroyed` | `unmounted` |
| `slot="name"` / `slot-scope` | `#name="{ ... }"` (v-slot) |
| `vue-svg-loader` | `build-utils/svg-loader.js`（Vue3対応版） |
| `vue-i18n 7.x` | `vue-i18n 9.x`（legacyモード、`$t()` は互換あり）|
| `new Vue({})` / `Vue.prototype` | `createApp({})` / `app.config.globalProperties` |

---

**Last Updated:** 2026-06-11
**Related Commit:** PR1296 (Vue 3 migration)
