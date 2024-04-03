import { IPatchNotes } from '.';

export const notes: IPatchNotes = {
  version: '1.1.20240403-unstable.1',
  title: '1.1.20240403-unstable.1',
  notes: [
    "修正: 放送者NG上限表示を一般会員もプレミアム会員と同じ500に (#735) by koizuka",
    "修正: 音声デバイスが一つも無いときにボイスチェンジャーソースが削除できなくなっていた (rtvcライブラリを1.0.4に更新) (#729) by asaday",
    "調査用: ボイスチェンジャーソースが一覧に出ないときに音声ソース一覧とOBSログをSentryに送信する (#737) by koizuka",
  ]
};
