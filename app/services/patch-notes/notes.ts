import { IPatchNotes } from '.';

export const notes: IPatchNotes = {
  version: '1.1.20260513-unstable.1',
  title: '1.1.20260513-unstable.1',
  notes: [
    "追加: Spout2キャプチャソースのサポートを追加 (#1215) by asaday",
    "追加: オーディオフィルター (リミッター/エキスパンダー/位相反転) を有効化 (#1243) by koizuka",
    "追加: シーン切り替え時にソースがスムーズに移動する「モーション」を追加 (#1246) by koizuka",
    "修正: AMDエンコーダー使用時のニコニコ最適化が毎回失敗していた問題を修正 (#1249) by asaday",
    "修正: コメント読み上げ停止機能の設定案内ダイアログを初回のみ表示するよう変更 (#1232) by koizuka",
    "改善: 起動時にパッチノートがすぐに表示されるように (#1234) by koizuka",
  ],
};
