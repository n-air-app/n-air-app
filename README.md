# N Air

[![Build status](https://github.com/n-air-app/n-air-app/actions/workflows/test.yml/badge.svg)](https://github.com/n-air-app/n-air-app/actions/workflows/test.yml)

N Air は Streamlabs OBS をベースにした、生放送に便利な機能が豊富に組み込まれた高画質配信ソフトです。NLE（Niconico Live Encoder）よりも、さらに便利になって生まれ変わりました。
![image](https://github.com/user-attachments/assets/5e53d0da-1751-4d37-8d39-4aac7588224e)

## 動作条件

- DirectX 10.1 互換の GPU
- Windows 11 以降(64 ビット版)
- メモリ：8GB 以上
- CPU：Core i5 第四世代相当
- インターネット接続環境が必要です。

## インストール

<https://n-air-app.nicovideo.jp/>

## ビルド方法

### Node.js

npm パッケージをインストールし、さまざまなスクリプトを実行するには Node が必要です。

現在の LTS リリース 22.x.x を推奨します：<https://nodejs.org/>

### pnpm

各ノードモジュールの正しいバージョンを使用するためには、pnpm パッケージマネージャーを使用する必要があります。

Corepack が有効なら自動的にインストールされます。
手動インストール方法については、こちらを参照してください：<https://pnpm.io/ja/installation>

### インストール

1. [N Voice](https://github.com/n-air-app/n-voice-package) のモジュールが GitHub Repository を使っているため、GitHub の[Personal Access token(classic)を read:packages スコープをつけて作成](https://github.com/settings/tokens)し、npm login する。

```bash
npm login --scope=@n-air-app --registry=https://npm.pkg.github.com
> Username: USERNAME (of GitHub)
> Password: TOKEN (GitHub Personal Access Token(classic) with read:packages scope)
```

2. GitHub への SSH 鍵登録（git 依存関係を使用するため必要）

一部の依存関係は GitHub リポジトリから直接取得されます（例: sl-vue-tree）。
これらは SSH 経由でクローンされるため、GitHub に SSH 公開鍵を登録する必要があります。

**症状**: pnpm install 実行時に以下のようなエラーが出る場合は、SSH 鍵の設定が必要です:

```
Host key verification failed.
fatal: Could not read from remote repository.
Please make sure you have the correct access rights
```

**設定手順**:

- SSH 鍵の生成と GitHub への登録方法は、GitHub 公式ドキュメントを参照してください
  - [SSH 鍵の生成](https://docs.github.com/ja/authentication/connecting-to-github-with-ssh/generating-a-new-ssh-key-and-adding-it-to-the-ssh-agent)
  - [GitHub アカウントへの SSH 鍵の追加](https://docs.github.com/ja/authentication/connecting-to-github-with-ssh/adding-a-new-ssh-key-to-your-github-account)

**注意**: CI 環境では `git config` で HTTPS へ自動変換されるため、SSH 鍵設定は不要です。

3. pnpm を介してすべての node モジュールをインストールする。

```bash
pnpm install
pnpm install --dir bin # binディレクトリのpnpm installも実行する(pnpm start に必要)
```

4. webpack を使用してアセットをコンパイルする。

```bash
pnpm run compile
```

### 実行

Visual Studio Code を使用している場合は、組み込みのデバッガを使用してアプリケーションを実行できます（デフォルトの F5 ボタン）。
それ以外の場合は以下のコマンドにより実行可能です。

```
pnpm start
```

### 開発者向け設定

環境変数、dev環境接続（dev-hosts）、npmスクリプト、設定ファイル等の詳細は [docs/development.md](docs/development.md) を参照してください。

## ライセンス

N Air 本体は GPLv3 で公開しています。

N Air には外部の多くのソフトウェアを利用しております。それらに関しては各パッケージのライセンス条項を御確認ください。

## Special Thanks

This Open Source Program is forked from Streamlabs OBS, a software originally created by Streamlabs.

## 開発への参加について

N Air はオープンソースであり、どなたでも開発に参加できます。プルリクエストは n-air-development ブランチに出すようお願いいたします。

## バグ報告

- フィードバックへのリンク
  - <https://form.nicovideo.jp/forms/n_air_feedback>
- issue
  - <https://github.com/n-air-app/n-air-app/issues>

## ヘルプページへのリンク

<https://qa.nicovideo.jp/faq/show/11857>
