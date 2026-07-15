export interface ITreeNodeModel<TData = unknown> {
  title: string;
  isLeaf?: boolean;
  children?: ITreeNodeModel<TData>[] | null;
  isExpanded?: boolean;
  isSelected?: boolean;
  isDraggable?: boolean;
  isSelectable?: boolean;
  data?: TData;
}

export interface ITreeNode<TData = unknown> extends Omit<ITreeNodeModel<TData>, 'children'> {
  children: ITreeNode<TData>[];
  /** ルートからのインデックスパス。同じツリーモデルを描画している間だけ有効。 */
  path: number[];
  pathStr: string;
  level: number;
  ind: number;
  isFirstChild: boolean;
  isLastChild: boolean;
}

export type TDropPlacement = 'before' | 'inside' | 'after';

export interface ITreeCursorPosition<TData = unknown> {
  node: ITreeNode<TData>;
  placement: TDropPlacement;
  /** 移動後の親。null はルート階層を表す。 */
  parentNode?: ITreeNode<TData> | null;
  /** この兄弟ノードの直前へ挿入する。null は親階層の末尾を表す。 */
  beforeNode?: ITreeNode<TData> | null;
  /** ラインを描画する行。 */
  lineNode?: ITreeNode<TData>;
  /** ラインを行の上下どちらへ描画するか。 */
  linePlacement?: Extract<TDropPlacement, 'before' | 'after'>;
  /** 移動後の階層。ルートを1とする。 */
  lineLevel?: number;
}
