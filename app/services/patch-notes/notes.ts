import { IPatchNotes } from '.';

export const notes: IPatchNotes = {
  version: '1.1.20241016-unstable.1',
  title: '1.1.20241016-unstable.1',
  notes: [
    "修正: 「##このコメントは表示されません##」を読み上げない (#846) by koizuka",
    "修正: コメントを再読み込みするとブロックしたはずのコメントのブロックが解除されたように見えていた (#844) by koizuka",
    "修正: シーン切り替え画面などに使われるオーバーレイの外側の背景色が透過していなかった(黒い額縁に見えていた) (#848) by yusukess",
    "修正: シーン切り替え画面の調整(設定項目が表示しきれていなかった、など) (#850) by yusukess",
    "更新: 組み込みOBSのバージョンを29へ (#782) by asaday",
  ]
};
