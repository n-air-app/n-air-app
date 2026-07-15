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
}
