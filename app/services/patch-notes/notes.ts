import { IPatchNotes } from '.';

export const notes: IPatchNotes = {
  version: '1.1.20230317-1',
  title: '1.1.20230317-1',
  notes: [
    "修正:20230316のリリースの内部的な問題を修正 (#622)",
    "以下は20230316の更新内容です：",
    "改善:琴詠ニアが各種サービス名を読める (#618)",
    "改善:数値入力フォームの値更新を確定まで待つ (#235)",
    "改善:配信開始時にニコ生ログイン状態なら番組情報取得も行う (#610)",
    "修正:ログイン状態確認に失敗したときにログアウトに移行できていないケースがあった (#605)",
    "修正:幾つかの実行時エラーを修正 (#601)",
    "修正:更新ダイアログの見た目を修正 (#602)",
    "修正:高度な音声設定ウィンドウのサイズを微調整 (#604)",
    "改善:ニコ生の番組情報のビットレートなどの設定値の将来変更に対応 (#611)",
  ]
};
