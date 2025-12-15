# N Air

[![Build status](https://github.com/n-air-app/n-air-app/actions/workflows/test.yml/badge.svg)](https://github.com/n-air-app/n-air-app/actions/workflows/test.yml)

N Air は Streamlabs OBS をベースにした、生放送に便利な機能が豊富に組み込まれた高画質配信ソフトです。NLE（Niconico Live Encoder）よりも、さらに便利になって生まれ変わりました。
![image](https://github.com/user-attachments/assets/5e53d0da-1751-4d37-8d39-4aac7588224e)

## 動作条件

- DirectX 10.1 互換の GPU
- Windows 10 以降(64 ビット版)
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

2. pnpm を介してすべての node モジュールをインストールする。

```bash
pnpm install
pnpm install --dir bin # binディレクトリのpnpm installも実行する(pnpm start に必要)
```

3. webpack を使用してアセットをコンパイルする。

```bash
pnpm run compile
```

### 実行

Visual Studio Code を使用している場合は、組み込みのデバッガを使用してアプリケーションを実行できます（デフォルトの F5 ボタン）。
それ以外の場合は以下のコマンドにより実行可能です。

```
pnpm start
```

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
