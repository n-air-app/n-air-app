# 開発者向けガイド

## 目次

- [環境変数](#環境変数)
- [dev-hosts（dev環境接続）](#dev-hostsdev環境接続)
- [主要なnpmスクリプト](#主要なnpmスクリプト)
- [設定ファイル一覧](#設定ファイル一覧)

---

## 環境変数

### 開発・デバッグ用

| 変数名                            | 用途                                                                                                                                                                     |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `DEV_SERVER`                      | webpack devServer の URL（`pnpm dev` で自動設定。`http://localhost:8080/index.dev.html`）。設定するとlocalhost APIプロキシ・フェイクモード・DevTools自動起動が有効になる |
| `NAIR_DEV_HOSTS`                  | dev-hosts設定ファイルの選択インデックス（`.dev-hosts-path` の行番号、1始まり）。詳細は[dev-hostsセクション](#dev-hostsdev環境接続)を参照                                 |
| `NAIR_LOGIN_URL`                  | OAuth ログインURLのオーバーライド                                                                                                                                        |
| `NAIR_PRODUCTION_DEBUG`           | 本番ビルドでも DevTools や dev機能を有効化                                                                                                                               |
| `NAIR_REPORT_TO_SENTRY`           | 非本番ビルドで Sentry への送信を有効化                                                                                                                                   |
| `NAIR_DISABLE_MAIN_LOGGING`       | メインプロセスの `console.log` 転送を抑制                                                                                                                                |
| `NAIR_DEBUG_CRASH_HANDLER`        | `DEV_SERVER` 時にもクラッシュハンドラを有効化                                                                                                                            |
| `NAIR_FORCE_AUTO_UPDATE`          | 非本番ビルドで自動更新を強制有効化                                                                                                                                       |
| `NAIR_FAKE_PROGRAM`               | フェイク番組モードを有効化（`DEV_SERVER` と組み合わせて使用）                                                                                                            |
| `NAIR_ENABLE_TCP_API`             | 本番ビルドで TCP API (`127.0.0.1:28194`) を有効化（`1`/`true` のみ有効）。開発ビルドでは常に有効。一般ユーザー向けには設定画面「一般」タブの「TCP API を有効にする」トグルを使用 |
| `NAIR_UPDATE_I18N_NOT_FOUND_KEYS` | 未翻訳キーを `i18n-not-found-keys.txt` に出力                                                                                                                            |
| `NDGR_SERVER`                     | モデレーター表示サーバー URL のオーバーライド                                                                                                                            |

### チャンネル・ブランディング（自動設定）

以下は `main.js` が `package.json` の内容を元に自動設定するため、手動設定は通常不要です。

| 変数名              | 用途                                                                 |
| ------------------- | -------------------------------------------------------------------- |
| `NAIR_UNSTABLE`     | unstable チャンネル（`pnpm start:unstable` / `pnpm dev` で自動設定） |
| `NAIR_VERSION`      | `package.json` の `version` から自動設定                             |
| `NAIR_PRODUCT_NAME` | `package.json` の `buildProductName` から自動設定                    |

### ビルド・リリース（CI / ローカルリリース）

| 変数名                     | 用途                                                 |
| -------------------------- | ---------------------------------------------------- |
| `SENTRY_AUTH_TOKEN`        | webpack ビルド時の Sentry ソースマップアップロード用 |
| `INTERNAL_PUBLISH_URL`     | 社内版配布先のベース URL                             |
| `CERTIFICATE_SUBJECT_NAME` | Windows コード署名証明書のサブジェクト名             |

### テスト用

| 変数名                    | 用途                                         |
| ------------------------- | -------------------------------------------- |
| `NAIR_TEST_STREAM_SERVER` | E2E ストリーミングテスト用 RTMP サーバー URL |
| `NAIR_TEST_STREAM_KEY`    | E2E ストリーミングテスト用ストリームキー     |

---

## dev-hosts（dev環境接続）

dev-hosts は本番ドメイン（`*.nicovideo.jp` 等）を dev 環境ドメインに置換して接続する仕組みです。
設定は gitignored のファイルで管理するため、通常のビルドには一切影響しません。

### 設定ファイルの形式

`.dev-hosts.example.json` を参考に、以下の形式で設定ファイルを作成します（任意の場所に配置可）:

```json
{
  "domainMap": {
    "nicovideo.jp": "dev.nicovideo.jp"
  },
  "overrides": {
    "https://api.live2.nicovideo.jp": "https://api01.live2.dev.nicovideo.jp"
  },
  "cookieDomain": ".nicovideo.jp"
}
```

| フィールド     | 説明                                                                                                                          |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `domainMap`    | ドメインサフィックスの一括置換。`"nicovideo.jp": "dev.nicovideo.jp"` なら `account.nicovideo.jp` → `account.dev.nicovideo.jp` |
| `overrides`    | 特定 URL プレフィックスの例外置換（`domainMap` より優先）。longest prefix match で適用                                        |
| `cookieDomain` | dev 環境の cookie が有効なドメイン（通常は本番と同じ `.nicovideo.jp`）                                                        |

### セットアップ手順

1. **設定ファイルを作成する**

   上記の形式で設定ファイルを作成し、プロジェクト外の任意の場所（例: 秘匿リポジトリ）に置きます。

2. **`.dev-hosts-path` を作成する**

   プロジェクトルートに `.dev-hosts-path`（gitignored）を作成し、設定ファイルへの相対パスを記載します:

   ```
   ../your-private-repo/dev-hosts-staging.json
   ../your-private-repo/dev-hosts-test.json
   ```

   複数行で複数環境を列挙でき、`NAIR_DEV_HOSTS=N`（1始まり）で選択します。

3. **コンパイルして起動する**

   ```bash
   NAIR_DEV_HOSTS=1 pnpm compile && pnpm start
   ```

   コンパイル時に `dev-hosts.json` がプロジェクトルートに生成され、以後は **`pnpm start` だけ**で dev 環境として起動します（`NAIR_DEV_HOSTS` の指定不要）。

4. **通常環境に戻す**

   ```bash
   pnpm compile   # NAIR_DEV_HOSTS なし
   ```

   フラグなしでコンパイルすると `dev-hosts.json` が自動削除され、次回 `pnpm start` から本番環境として起動します。

### パッケージビルド

`dev-hosts.json` がプロジェクトルートに存在する状態でパッケージビルドを行うと、自動的に asar にバンドルされます:

```bash
# ローカルインストーラー
NAIR_DEV_HOSTS=1 pnpm compile:production && pnpm package:local

# ローカルインストーラー（無人インストール＋起動も含めて一括実行）
NAIR_DEV_HOSTS=1 pnpm run package:local:install

# 既に dist/ にあるインストーラーだけを無人インストール＋起動（package:local 以外の成果物でも可）
pnpm run install:dist

# 社内版インストーラー
NAIR_DEV_HOSTS=1 pnpm compile:production && pnpm package:internal-stable
```

### 動作上の特徴

- **Cookie 分離**: dev / 本番で独立した Electron session partition（`persist:dev-hosts`）を使用。ビルドを切り替えてもログイン状態が干渉しない
- **タイトルバー**: シアン色（`#009af4`）+「dev環境」バッジで視覚的に区別
- **通常ビルドへの影響なし**: `dev-hosts.json` がなければ全て本番動作

---

## 主要なnpmスクリプト

### 開発

| スクリプト                    | 用途                                                          |
| ----------------------------- | ------------------------------------------------------------- |
| `pnpm compile`                | 開発用ビルド（webpack development モード）                    |
| `pnpm run compile:production` | 本番用ビルド（webpack production モード）                     |
| `pnpm run watch`              | ウォッチモード（変更時に自動再ビルド）                        |
| `pnpm start`                  | アプリ起動（バージョンに応じて stable / unstable を自動選択） |
| `pnpm dev`                    | webpack devServer + Electron を同時起動（HMR 有効）           |

### テスト・品質

| スクリプト           | 用途                                                                    |
| -------------------- | ----------------------------------------------------------------------- |
| `pnpm test`          | フルテストスイート（i18n チェック + TypeScript コンパイル + node:test） |
| `pnpm run test:unit` | ユニットテスト（Jest）                                                  |
| `pnpm lint`          | ESLint + Stylelint                                                      |
| `pnpm format`        | ESLint fix + Stylelint fix                                              |
| `pnpm screentest`    | ビジュアルリグレッションテスト                                          |

### ネイティブホットキーの実動作テスト（Windows x64）

`test/e2e/hotkeys.ts` は通常の E2E スイート（`pnpm test`）の1つです。
テスト用の N Air にシーン切り替えホットキーを1件登録し、Windows の `SendInput`
で F24 を1回押下・解放して、対象のシーンがアクティブになることを確認します。
実物の `node-libuiohook` とアプリのホットキーサービスを通るテストです。

このテストだけ実行する場合:

```powershell
pnpm run compile-tests
node --test --test-force-exit --test-concurrency=1 test-dist\test\e2e\hotkeys.js
```

ほかの E2E テストと同様、事前に `pnpm run compile` でアプリをビルドしてください。

- 対話可能な Windows デスクトップと Windows PowerShell が必要です。
- **F24 の入力はデスクトップ全体に届きます。他アプリに F24 の割り当てがないことを確認してください。**
  実行中は修飾キーを押さず、他のキー操作を控えてください。
- 既存の E2E ヘルパーの一時プロファイルで起動し、通常使用の設定は変更しません。
- ホットキーの登録は API 経由です。設定画面でのキー割り当て操作自体は対象外です。

### パッケージビルド

| スクリプト                       | 用途                                                                                                            |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `pnpm package:local`             | ローカル用インストーラー（コード署名なし）。`dev-hosts.json` があれば自動で dev 対応                            |
| `pnpm run install:dist`          | `dist/` にある既存インストーラーを無人インストール＋アプリ起動（再ビルド不要。どの `package:*` の成果物でも可） |
| `pnpm run package:local:install` | `compile:production` → `package:local` → `install:dist` を一括実行                                              |
| `pnpm package:internal-stable`   | 社内版 stable インストーラー（`INTERNAL_PUBLISH_URL` 必須）。`dev-hosts.json` があれば自動で dev 対応           |
| `pnpm package:internal-unstable` | 社内版 unstable インストーラー（`INTERNAL_PUBLISH_URL` 必須）。`dev-hosts.json` があれば自動で dev 対応         |
| `pnpm package:public-stable`     | 公開版 stable インストーラー                                                                                    |
| `pnpm package:public-unstable`   | 公開版 unstable インストーラー                                                                                  |

### インストーラーの動作確認（`install:dist`）

`pnpm run install:dist` は `dist/` に既にあるインストーラーを `/S --updated --force-run` 付きで実行し、無人インストール後にアプリを起動します。`package:local` に限らず `package:public-stable` などどの `package:*` が作った `n-air-app-setup.*.exe` でも動作します。再ビルドが不要なため、インストール手順だけを繰り返し試したいときは対象の `package:*` の直後にこれだけを使うと速いです（ローカルビルドを最初から通す場合は `package:local:install` を使ってください）。

- **UAC 確認ダイアログが1回表示されます。** `nsis.perMachine: true` のため昇格が必須で、これは抑制できません。管理者権限のシェルから実行すればダイアログは出ません
- `--updated` により VC++ ランタイムのダウンロードと、起動中の N Air の確認なし終了をスキップしています
- ライセンス同意ページ・インストール先選択・完了ページはサイレントインストールのため検証されません。それらを確認したい場合は `dist/` の exe を直接ダブルクリックしてください
- 失敗パス（旧バージョンのアンインストール失敗、vc_redist ダウンロード失敗）のエラーダイアログはサイレントでも表示されます。固まったように見えたら裏に隠れたダイアログを探してください。Ctrl+C では昇格したインストーラーを止められません
- **`appId` が同じチャンネル同士は既存インストールを上書き/アンインストールします。** `public-stable` / `internal-stable` / `local` は同一 appId (`jp.nicovideo.nair`)、`public-unstable` / `internal-unstable` は別の同一 appId (`jp.nicovideo.nair-unstable`) を共有しています。実行時に `dist/win-unpacked` の exe 名を表示するので、意図したチャンネルかを確認してください
- `pnpm run install:dist -- --no-run` でインストールのみ行い、アプリを起動しないようにできます

### コード署名のハッシュアルゴリズム

`electron-builder/stable.config.js`（unstable / internal も継承）では `win.signtoolOptions.signingHashAlgorithms: ['sha256']` を指定し、署名を SHA256 のみにしています。未指定だと electron-builder は `['sha1', 'sha256']` で2重署名し、ファイルごとに signtool とタイムスタンプ取得が2回走るため、署名工程が約2倍かかります。SHA1 署名が必要なのは SHA2 未対応の Windows 7 / Vista だけで、Electron 23 以降は Windows 7 / 8 / 8.1 のサポートが終了し Windows 10 以上が前提のため、不要です（Electron を上げても、23 未満に戻さない限りこの前提は変わりません）。

- **署名鍵の種類（RSA → ECDSA など）を変えるときは、この設定との整合を確認してください。** `signingHashAlgorithms` はダイジェスト（ファイルハッシュ・タイムスタンプ）のアルゴリズムを固定するもので、署名鍵の種類とは別物です。ただし証明書やツール（Azure Trusted Signing 等の `azureSignOptions` への移行を含む）を変える際は、`signtoolOptions` 自体が使われなくなる／アルゴリズム指定の方法が変わる可能性があります
- 署名後は `signtool verify /pa /all <file>` で、`Algorithm` が `sha256`、`Timestamp` が `RFC3161` の1行だけになっていることを確認できます
- 計測値（ローカル署名ビルド、`package:local` に `CERTIFICATE_SUBJECT_NAME` を設定、署名対象 24 ファイル）: 5分24秒 → 3分34秒（約1分50秒短縮）

### 同梱 exe の署名キャッシュ

`CERTIFICATE_SUBJECT_NAME` が設定されているときは、`win.signtoolOptions.sign` に `electron-builder/sign-with-cache.js` を指定し、同梱 exe（obs-studio-node、crash-handler、vosk-cli、n-voice、elevate.exe など）の署名済みファイルをキャッシュします。2回目以降のビルドでは signtool を呼ばずにコピーで済ませます（PIN 入力も不要）。

- キャッシュのキーは「署名前ファイルの sha256」と「入力パスを除いた signtool の引数」（証明書の thumbprint、ハッシュアルゴリズム、タイムスタンプサーバ、`/d` の製品名など）。証明書の更新や stable / unstable / 社内版 / local の違いではキーが変わり、それぞれ初回は全部署名します
- バージョンが埋め込まれるメイン exe・インストーラ・アンインストーラは毎回署名します
- キャッシュの場所は `%LOCALAPPDATA%\n-air-app\sign-cache`（`NAIR_SIGN_CACHE_DIR` で変更可）。署名し直したいときはこのディレクトリを削除してください。古いエントリは自動では消えないので、依存更新が続いて大きくなったら削除して構いません
- ビルドログの `sign cache hit` / `sign cache stored` でキャッシュの利用状況を確認できます
- 計測値（`package:local`、署名あり）: 初回 3分22秒 → 2回目 2分11秒（同梱 exe 21 ファイルがキャッシュから取得、約70秒短縮）

---

## 設定ファイル一覧

| ファイル                  | git管理    | 用途                                                                     |
| ------------------------- | ---------- | ------------------------------------------------------------------------ |
| `.dev-hosts-path`         | gitignored | dev-hosts 設定ファイルへのパス一覧（1行1パス）                           |
| `dev-hosts.json`          | gitignored | `pnpm compile`（`NAIR_DEV_HOSTS` 指定時）に自動生成される dev-hosts 設定 |
| `.dev-hosts.example.json` | tracked    | dev-hosts 設定ファイルのテンプレート                                     |
| `.npmrc`                  | tracked    | pnpm 設定（`node-linker=hoisted` でネイティブモジュール対応）            |
| `sentry-defs.js`          | tracked    | Sentry 組織・プロジェクト定義                                            |
