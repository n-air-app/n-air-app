import { IPatchNotes } from '.';

export const notes: IPatchNotes = {
  version: '1.1.20241217-unstable.1',
  title: '1.1.20241217-unstable.1',
  notes: [
    "追加: 番組の合い言葉のコピー機能 (#871) by koizuka",
    "修正: ボイスチェンジャーなどの音声デバイスが読み込めないときにシーンコレクション読み込み失敗になってしまうのを、他の部分は読み込むように修正 (#868) by koizuka",
    "修正: 更新説明が多いときのアップデーターのレイアウト崩れを修正 (#857) by yusukess",
    "修正: 設定-出力/NVENCのエンコーダープリセットの文言再翻訳 (#853) by koizuka",
    "改善: アンインストール時にアプリデータを削除する画面を追加 (#866) by koizuka",
    "改善: ニコ生最適化の対象ハードウェアにamdを追加 (#854) by asaday",
    "改善: 検索が必要が無い設定の選択肢入力項目から検索入力欄を削除(操作性改善) (#865) by asaday",
  ]
};
