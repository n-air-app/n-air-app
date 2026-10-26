# ラウドネス計測 調査メモ (issue #1517)

- issue: https://github.com/n-air-app/n-air-app/issues/1517
- 目的: 短期ラウドネス (short-term LUFS) を計測し、配信者の音量調整のガイドに使う
- ステータス: 調査中 (2026-10-23 開始)

## 1. 要求の整理

- 現状の目安はミキサーのオーディオレベルメーターのみ。これは**サンプルピーク (dBFS)** 表示で、聴感上の大きさ(ラウドネス)とずれる
- 欲しいのは ITU-R BS.1770 / EBU R 128 準拠の値
  - Momentary (M): 400ms 窓
  - **Short-term (S): 3s 窓** ← issue の主目的
  - Integrated (I): ゲート付き全区間平均 (配信全体の振り返り用途なら有用)
- 参考: ニコニコ動画のラウドネスノーマライゼーション ([記事](https://ch.nicovideo.jp/nicotalk/blomaga/ar1848078))
  - 基準 -15 LUFS (Integrated)、測定は EBU R 128 / ITU-R BS.1770-3
  - **対象は動画・動画広告・いきなり！動画紹介のみで、生放送は対象外**
  - 基準を超えたものを下げる方向のみ。小さいものは持ち上げない
  - → 生放送では「上げすぎても下げてもらえない、小さすぎても持ち上げてもらえない」ので、配信側でガイドする意味はむしろ大きい。目標値をいくつにするかは別途決める必要あり (後述)

## 2. ラウドネス計算に必要なもの

BS.1770 の計算は以下の通りで、**連続した生 PCM サンプル**が必要。

1. K-weighting フィルタ (高域シェルフ + ハイパスの biquad 2段) をサンプル単位でかける
2. チャンネルごとに平均二乗をとる (400ms ブロック、75% オーバーラップ)
3. チャンネル重み付き和 → `L = -0.691 + 10 log10(Σ G_i · z_i)`
4. Short-term は 3s 窓。Integrated は絶対ゲート -70 LUFS + 相対ゲート -10 LU

既製ライブラリとして [libebur128](https://github.com/jiixyj/libebur128) (MIT) が定番。OBS 用の既存プラグインもこれを使っている (§5)。

## 3. 現状のアプリで取れる音声データ

### 3.1 volmeter コールバック (既存)

`app/services/audio/audio.ts` の `handleVolmeterCallback` に `magnitude / peak / inputPeak` (dB, チャンネル毎) が来る。
ミキサー表示 (`MixerVolmeter.vue.ts`) と音声検出 (`sound-detector.ts`) はこれを使っている。

libobs 側の実装 (`libobs/obs-audio-controls.c`) を確認した結果:

- `magnitude` = **1オーディオティック分 (通常 1024 サンプル ≒ 21ms) の RMS** に fader 音量を掛けたもの
- K-weighting なし
- osn の client 側コールバックは `globalCallback` スレッドが **50ms 間隔ポーリング + best-effort gate (最大 250ms)** で最新値を拾う方式 (`obs-studio-client/source/callback-manager.cpp`)。サーバ側も `try_to_lock` で取れなければフレームを捨てる
  - → JS に届くのは「間引かれたスナップショット」で、全区間を連続にカバーしていない

**結論: volmeter からは正しい LUFS は計算できない。** RMS の時間平均で「なんちゃってラウドネス」は作れるが、K-weighting がない分、低域が多い声/BGM で数 dB ずれる。ガイド用途として精度不足のおそれ。

### 3.2 osn (obs-studio-node 0.25.56) の JS API

`node_modules/obs-studio-node/module.ts` を確認。生 PCM を JS に渡す API は**ない**。

- `IVolmeter` / `IFader`: 上記のレベル値のみ
- `ISource.callHandler(fn, input)`: ソースの `proc_handler` を名前で呼び、`calldata` の `"output"` 文字列を返す (`osn-source.cpp` の `CallHandler`)。**プラグインが proc を生やせば、JS から任意の値を取得するための口として使える**
- `ISource.sendMessage(settings)`: ソースへの一方向メッセージ

### 3.3 同梱ネイティブバイナリ

`node_modules/obs-studio-node/` 以下の DLL を文字列 grep で確認:

- `obs.dll` は `obs_add_raw_audio_callback` / `obs_source_add_audio_capture_callback` / `obs_get_audio_info` をエクスポートしている → プラグインから生 PCM を取る API は使える
- ラウドネス関連 (`lufs`, `loudness`, `r128`, `bs1770`) を含む同梱プラグインは**なし**
- ffmpeg (`avfilter-10.dll`) には `ebur128` フィルタがあるが、OBS のライブ音声経路とは繋がっていないので使いにくい

## 4. 既存の拡張手段: 独自 OBS プラグイン

N Air は既に独自 OBS プラグインを 2 つ持っており、`additional/additional.json` で postinstall 時に `obs-plugins/64bit` に配置している:

| プラグイン | リポジトリ | アプリとの通信 |
|---|---|---|
| `nair-rtvc-source.dll` | n-air-app/rtvc_plugin | ソース設定 (settings) |
| `nair-substream.dll` | n-air-app/substream | **Named Pipe `\\.\pipe\NAirSubstream` + 改行区切り JSON RPC** (`app/services/substream/NamedPipeClient.ts`) |

`nair-substream` は `obs_module_load` でパイプサーバスレッドを立て、`{id, fn, arg}` → `{id, res}` の RPC を処理している。
**ラウドネス計測プラグインもこの構成をほぼそのまま流用できる。**

substream のブランチとアプリの対応:

- アプリが使っているのは tag `1.1.1` (ブランチ `release/1.1.x-osn0.25.56`)。`thirdparty/obs-libs/VERSION` は `libobs 30.2.4sl41 / osn 0.25.56` でアプリと一致
- `main` (1.2.0) は `libobs 31.1.2sl19 / osn 0.26.28` 向けで、将来の osn 更新用
- → 新プラグインも同じく「osn バージョンごとのリリースブランチ」で管理し、`release/1.1.x-osn0.25.56` の `obs-libs` を流用すればよい

なお substream のパイプサーバは `nMaxInstances = 1` の単一接続。ラウドネス用は別のパイプ名にするのが無難。

## 5. 先行事例

- [norihiro/obs-loudness-dock](https://github.com/norihiro/obs-loudness-dock) (GPL-2.0): EBU R 128 メーター。M / S / I / LRA / True Peak を表示
  - `src/loudness.c`: `obs_add_raw_audio_callback(track, NULL, audio_cb, ...)` で**出力ミックストラック**の PCM を取得
  - audio スレッドのコールバックではインターリーブしてバッファに積むだけ、別スレッドで `ebur128_add_frames_float` → 処理を audio スレッドから逃がしている (参考にすべき設計)
  - `ebur128_init(channels, samples_per_sec, EBUR128_MODE_M | S | I | LRA | TRUE_PEAK)`
  - ライセンスが GPL-2.0 なのでコードを直接取り込むならライセンス整合を確認 (OBS プラグイン自体が libobs GPL 由来なので実質問題になりにくいはずだが要確認)
- Loudness Balance Monitor (OBS Forums resource 2327): libebur128 で short-term LUFS
- [VertexLink-LUFS](https://github.com/jazzhamz/VertexLink-LUFS): short-term LUFS ドック + ゲインフィルタ連携
- YouTube の「コンテンツのラウドネス」も同系統のアルゴリズム (基準 -14 LUFS)

## 5.5 libobs の音声タップ位置

`libobs/obs-source.c` を確認した結果:

- `obs_source_add_audio_capture_callback` は `source_output_audio_data()` の末尾で `source_signal_audio_data(source, data, muted)` として呼ばれる
  - **フィルタ適用後・音量フェーダー適用前**。データは出力フォーマット (サンプルレート・チャンネル数) にリサンプル済み
  - `muted` 引数でミュート状態も分かる
  - volmeter もこの位置から取っていて、`obs-audio-controls.c` 側で `cur_db` (fader) を自前で掛けて post-fader 値にしている
  - → ソース単位の pre-fader / post-fader 両方を、**フィルタプラグインなしで**測れる (post-fader は `obs_source_get_volume()` を掛ける)
- `obs_add_raw_audio_callback(mix_idx, conv, cb, param)` は出力ミックストラック (0〜5) の最終音声。配信・録画に乗る音そのもの

## 6. 実装方式の候補

| 案 | 内容 | 精度 | ネイティブ作業 | 備考 |
|---|---|---|---|---|
| A | volmeter の magnitude から JS で近似 | × K-weighting なし・間引き | 不要 | すぐ試せるが「聴感とずれる」問題を解決しきれない |
| **B** | 独自プラグインで `obs_add_raw_audio_callback` (ミックストラック) + libebur128、結果を Named Pipe で返す | ◎ | 必要 (substream 流用) | **配信に乗る音そのもの**を測れる。本命 |
| C | 独自の**音声フィルタ**プラグインをマイクソース等に付け、`proc_handler` で値を返す → JS から `callHandler` で取得 | ◎ | 必要 | ソース単位で測れるが、§5.5 の capture callback で同じことができるため**不要** |
| D | プラグインは生 PCM をパイプで流すだけにし、BS.1770 は TS で実装 | ○ | 小 | 48kHz×2ch×float = 約 384KB/s。ロジックを TS で単体テストしやすいが、レンダラの負荷とパイプ遅延・欠落の扱いが課題 |
| E | WebAudio (getUserMedia) でマイクを直接測る | △ | 不要 | OBS 側のフィルタ・音量・ミックスが反映されない。デバイス競合も懸念。不採用寄り |

現時点の見立て: **B を本命とし、§5.5 のソース単位計測も同じ DLL に入れる**。A は「方式比較用の実験」として JS だけで先に作ってみる価値はある (B の結果と並べてずれ幅を確認できる)。

## 7. 方針 (2026-10-23 決定)

- **計測対象は決め打ちせず、どれも試せるようにする**。何を測るのが有用かは実際に試して判断する
  - 出力ミックストラック (配信に乗る音。視聴者が聞く音量)
  - ソース単位 pre-fader (マイクの入力そのもの。声の大きさ・入力ゲイン調整用)
  - ソース単位 post-fader (ミキサー音量を反映した値。BGM とのバランス用)
- **目標値は初期値 + ユーザー調整可能**にする
  - 初期値は仮に -15 LUFS (ニコ動の基準と同じ。比較: YouTube -14、配信でよく言われる値 -16)。試用しながら見直す
  - トーク中心だと short-term の揺れが大きいので、1 点ではなく許容範囲 (例: 目標 ±3 LU) で示すことも検討

### プラグイン設計の叩き台

1 つの DLL (仮称 `nair-loudness`) が複数の「メーター」を持てるようにし、メーターごとに libebur128 の state を 1 つ持つ。

- タップ: `track` (mix_idx 0〜5, `obs_add_raw_audio_callback`) / `source` (ソース名 + `pre` | `post`, `obs_source_add_audio_capture_callback`)
- audio スレッドのコールバックではバッファに積むだけにし、計算は別スレッド (obs-loudness-dock と同じ)
- RPC (Named Pipe, substream と同じ改行区切り JSON):
  - `create {tap}` → `{meterId}`
  - `get {meterId}` → `{momentary, shortTerm, integrated, ...}` (JS から 100〜200ms 間隔でポーリング)
  - `reset {meterId}` (Integrated のリセット。配信開始時など)
  - `destroy {meterId}`
- ソースの削除・リネームでメーターが宙に浮く問題に注意 (`source_remove` / `source_rename` シグナル、または JS 側で作り直す)
- `obs_module_unload` で**全メーターのコールバックを外し、計算スレッドを join してから**抜ける
  - substream はパイプスレッドの終了待ちをしていない (`WaitForSingleObject` がコメントアウト) が、こちらは audio スレッドから呼ばれるコールバックを持つため、後片付けが甘いと終了時クラッシュになる (既知の終了時ネイティブクラッシュ群を増やさないこと)

### リポジトリ構成 (新規リポジトリにする)

substream (`release/1.1.x-osn0.25.56`) の構成を雛形にする。

- リポジトリ名: `n-air-app/loudness` (決定)。DLL 名 `nair-loudness.dll`、パイプ名 `\\.\pipe\NAirLoudness` (案)
- 構成 (substream と同じ):
  - `nair-loudness.sln` + `nair-loudness/nair-loudness.vcxproj` (MSBuild, PlatformToolset v145, C++20)
  - `IncludePath` / `LibraryPath` に `thirdparty/obs-libs/{include,lib}` を指定
  - `thirdparty/obs-libs/` は substream `release/1.1.x-osn0.25.56` からコピー (`VERSION`: libobs 30.2.4sl41 / osn 0.25.56)。include と `obs.lib` は必ずセットで更新
  - `thirdparty/json.hpp` (nlohmann/json, MIT) も流用
  - `version.h` に `VERSION` / `TARGET_LIBOBS_VERSION` / `TARGET_OBS_STUDIO_NODE_VERSION`、`resource.rc` でバージョンリソースに埋め込む
- 追加: libebur128 (MIT)。`thirdparty/libebur128/` にソースを vendoring して vcxproj に直接含めるのが楽 (`ebur128.c` 1 ファイル + ヘッダ)
- ブランチ運用も substream に倣い、osn バージョンごとに `release/x.y.x-osnA.B.C` を切る
- リリース: GitHub Release に DLL を添付し、本体の `additional/additional.json` に URL を追加 (Release 本文に Compatibility 表を書く)
- ライセンス: **GPL-2.0-or-later (決定)**。libobs・obs-loudness-dock と揃える。libebur128 (MIT) と nlohmann/json (MIT) の表記を `thirdparty/LICENSES` に置く

#### ライセンスの判断材料

| 対象 | ライセンス |
|---|---|
| libobs (リンク先) | GPL-2.0-or-later |
| obs-studio-node | GPL-2.0 |
| N Air 本体 | GPL-3.0 |
| n-air-app/substream | GPL-3.0 |
| n-air-app/rtvc_plugin | GPL-2.0 |
| norihiro/obs-loudness-dock (参考実装) | GPL-2.0-or-later |
| libebur128 | MIT |

- libobs にリンクするので GPL 系は必須。**GPL-2.0-or-later と GPL-3.0 のどちらも libobs・N Air 本体と両立する**
- **GPL-2.0-or-later** の利点
  - libobs・obs-loudness-dock と同じライセンスになる。loudness-dock のコードを持ってきてもライセンスが変わらない
  - 他の OBS プラグイン (GPL-2.0-or-later が多い) や OBS 本体側にコードを還元・流用してもらいやすい
  - GPL-3.0 の N Air 本体と一緒に配布しても問題ない (or-later なので GPL-3.0 として扱える)
- **GPL-3.0** の利点
  - N Air 本体・substream と揃う
  - Apache-2.0 のライブラリを取り込める (GPL-2.0 とは非互換)。今回の依存 (libebur128 = MIT, nlohmann/json = MIT) では関係しない
- 注意: 「GPL-2.0-only」は選ばない。GPL-3.0 の本体との組み合わせで問題になりうる
- 実務上の差は小さい。どちらでもソースは公開しており、GPL-3.0 で追加される特許条項やハードウェア制限禁止の条項も今回は効いてこない
- CI: substream には GitHub Actions がなく手元 MSBuild ビルド。新リポジトリでは windows runner で MSBuild + Release 添付まで自動化しておくと osn 更新時に楽 (任意)

## 8. 未決事項 / 次に調べること

- [x] **どのトラックが配信に乗るか**: osn 0.25.56 の `obs-studio-server/source/nodeobs_service.cpp` `createAudioStreamingEncoder()` で確認
  - シンプルモード: `trackIndex = 0` 固定 → **トラック1** (`mix_idx` 0)
  - 詳細モード: `AdvOut.TrackIndex - 1` (ニコニコ最適化では `TrackIndex = 1` → `mix_idx` 0)
  - `obs_add_raw_audio_callback` の `mix_idx` は 0 始まり。実装時は JS 側で出力設定から `mix_idx` を決めてプラグインに渡す
  - 参考: nair-substream のサブ配信も `obs_audio_encoder_create(..., mixer_idx = 0, ...)` なのでトラック1
- [ ] 目標値の初期値を実際の配信音声で検証
- [x] 新規リポジトリ [n-air-app/loudness](https://github.com/n-air-app/loudness) (GPL-2.0-or-later, 当面 private) を作成し、雛形を投入 (2026-10-26)
  - 3 種類のタップ (track / source pre-fader / source post-fader)、M / S / I / LRA、Named Pipe RPC (`info` / `create` / `get` / `reset` / `destroy` / `destroyAll`) まで実装済み。プロトコルは同リポジトリの README を参照
  - ローカル (VS 2022) と GitHub Actions (windows-latest) でビルドが通ることを確認。**OBS 上での動作確認はまだ**
- [x] DLL を N Air に手で置いて読み込まれるか確認 (OBS ログに `[nair-loudness] plugin ... loaded`) (2026-10-26)
- [x] `tools/probe.mjs` (loudness リポジトリ) で `create` / `get` を叩いて値を確認 (2026-10-26)
  - track / source pre / source post の 3 種類とも想定どおり動作。ミュート中は post だけ null、pre は値が出る
  - 1kHz ステレオ -23 dBFS のサイン波をメディアソースで再生し、`track1` が **-23.0 LUFS** になることを確認 (BS.1770 の期待値どおり)
  - 不具合 1 件を修正: Streamlabs 版 libobs (30.2.4sl41) の `do_audio_output()` は `obs_add_raw_audio_callback` の param を `struct obs_encoder *` として読むため、任意のポインタを渡すと範囲外読み込みでトラックの音声が届かないことがあった。ゼロ埋めした大きな領域を param にして回避 (loudness `f757562`)
- 手元のマイク (Realtek 内蔵) は話し声の Integrated が約 -38 LUFS で、ミキサー 100% でも目標 -15 LUFS に 20 LU 以上足りない。ガイド機能では「ミキサーでは上げられない、OS の入力音量やゲインフィルタで上げる」ことを案内する必要がありそう
- [x] N Air 本体側から `NamedPipeClient` で呼び出してサービス化する (2026-10-26、実機での表示確認はまだ)

## 9. 申し送り (2026-10-26 時点)

### 作業環境

- 本体: worktree `../n-air-app-loudness` (ブランチ `research/loudness-1517`、push 先 `koizuka`)。メインディレクトリはリリースに使うので、`nair-loudness.dll` は**この worktree にだけ**置いている
  - DLL の置き場所: `node_modules/obs-studio-node/obs-plugins/64bit/nair-loudness.dll` (手でコピー。`pnpm install` し直すと消えることがある)
  - DLL は N Air 起動中はロックされるので、差し替えは N Air を閉じてから
- プラグイン: `../loudness` (= `n-air-app/loudness`, private, `main`)。最新 `f757562`
  - ビルド: `"/c/Program Files/Microsoft Visual Studio/2022/Community/MSBuild/Current/Bin/amd64/MSBuild.exe" nair-loudness.sln -p:Configuration=Release -p:Platform=x64` → `x64/Release/nair-loudness.dll`
  - Claude Code の worktree セッションからは `../loudness` で直接コマンドを実行できない (worktree 隔離)。`C:/temp/` にシェルスクリプトを書いて `sh` で実行すれば回避できた
  - 動作確認: `node ../loudness/tools/probe.mjs [--list] [--source <sourceId>]`
  - 精度確認用 WAV: `../loudness/tools/test-signals/sine-1khz-stereo-{15,23,33}dbfs.wav` (git 管理外。`tools/make-test-signals.mjs` で再生成)

### 本体側の実装 (このブランチ)

- `app/services/loudness/loudness.ts` `LoudnessService` (PersistentStatefulService, `app-services.ts` 登録済み。`measureSource()` / `applyAdjustment()` で自動調整も担当)
  - `enable()` / `disable()` (ネスト対応) で配信トラックのメーターを作成・破棄し、200ms ごとに `get` をポーリング
  - start / stop / poll / reset は `lifecycle` Promise で直列化
  - 配信トラックは `SettingsService.state.Output` の `Mode` / `TrackIndex` から決める (native を呼ばない)。ポーリング時に変化を検知したらメーターを作り直す
  - 接続できない・エラー応答は `unavailable` にして Sentry に 1 回だけ送る (DLL は同梱前提なので異常扱い。ユーザー判断)
  - 目標値 `targetLufs` は state に永続化 (初期値 -15)。`setTargetLufs()` はあるが**設定 UI はまだない**
- `app/components/studio/MixerLoudness.vue(.ts)`: ミキサー上部に 1 行表示 (short-term LUFS と目標との差)。目標 ±3 LU を適正 (accent 色)、超過は黄色、不足・未確定は暗色。ダブルクリックで Integrated リセット。ツールチップに目標と Integrated
- i18n: `audio.loudness` / `audio.loudnessTooltip` / `audio.loudnessUnavailable` (ja-JP / en-US)
- テスト: `app/services/loudness/loudness.test.ts` (18 件 pass)。typecheck / eslint / stylelint / i18n チェック pass

### 実機確認済みの機能 (2026-10-26)

- ミキサー上部の表示: サイン波 -23 dBFS で `-23.0 LUFS`。目標との差は数値ではなく「音量が小さいです / 大きいです / ちょうどよい音量です」で表示する (ライトなユーザー向け)
  - 色は対処が必要なとき (小さい・大きい) の黄色だけ。アクセシビリティのため赤系は使わない (`--color-accent` は赤系なので適正表示に使わない)
  - ラベルのクラス名に `.label` を使わない (vendor/foundation.min.css の `.label` が水色の背景を当てる)
- 目標値: ラウドネス行を右クリックして -14 / -15 / -16 / -18 / -23 LUFS から選ぶ。許容幅 ±3 LU は固定
- 自動調整 (`LoudnessAdjust` ダイアログ): 「音量が小さい/大きい」のとき「調整する」ボタンから起動
  - 調整するソースを選び (ミュートされていないもの、初期値はマイク)、約 8 秒そのソース単体 (pre-fader) を測って、有音区間の中央値で判断する
  - 小さい: フェーダーを 0 dB に戻し、足りない分を `gain_filter` で足す。既存のゲインフィルタは更新し、なければフィルタの先頭に追加。+20 dB で頭打ちにして OS の入力音量を案内する
  - 大きい: ゲインを足さず、既存ゲインを 0 に戻してフェーダーを下げる
  - 計算は `app/services/loudness/loudness-adjust.ts` (`planAdjustment`)

### 次にやること

1. プラグイン `n-air-app/loudness` は public 化し、タグ `0.1.0` で Draft Release (DLL + PDB) を作成済み。Publish して本体 `additional/additional.json` に DLL の URL を追加する (substream と同じく `/node_modules/obs-studio-node/obs-plugins/64bit` へ配置)
2. 実際の配信音声で目標値の初期値 (-15 LUFS) と許容幅 (±3 LU) を見直す
3. 自動調整に配信全体のメーター (BGM を含む) を使うか検討する (現状はマイク単体を目標に合わせる)

### 既知の注意点

- Streamlabs 版 libobs は `obs_add_raw_audio_callback` の param を `struct obs_encoder *` として読む。プラグイン側でゼロ埋めした大きな領域を param にして回避済み (§8)
- `pnpm exec jest app/services/settings app/services/audio app/components/studio` で "worker process has failed to exit gracefully" が出るが、loudness のテスト単体では出ないので既存テスト由来
- [x] DLL の署名: アプリ同梱時のパッケージングで署名されるため、リポジトリ側では不要 (付けても上書きされる)
- [ ] libebur128 のビルドとライセンス表記 (MIT)
- [ ] 計算負荷: libebur128 の True Peak モードはオーバーサンプリングで重め。S だけなら軽いはず
- [ ] UI: ミキサーに LUFS 表示を足すのか、別のガイド UI を作るのか
- [ ] まず案 A を JS で試作し、実際の配信音声で「magnitude 平均」がどれくらいずれるか確認するか?

## 参考

- ITU-R BS.1770 (ラウドネス測定アルゴリズム)
- EBU R 128 / EBU Tech 3341 (メーター仕様: M/S/I の定義)
- libobs `obs-audio-controls.c` (volmeter 実装)
- obs-studio-node `obs-studio-server/source/osn-volmeter.cpp`, `osn-source.cpp`, `obs-studio-client/source/callback-manager.cpp`
- n-air-app/substream `nair-substream/main.cpp`
