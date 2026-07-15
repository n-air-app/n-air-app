import { ITreeNode, ITreeNodeModel, TDropPlacement } from './types';

export function buildTreeNodes<TData>(models: ITreeNodeModel<TData>[], parentPath: number[] = []): ITreeNode<TData>[] {
  return models.map((model, ind) => {
    const path = [...parentPath, ind];
    return {
      ...model,
      isLeaf: !!model.isLeaf,
      isExpanded: model.isExpanded === undefined ? true : !!model.isExpanded,
      isSelected: !!model.isSelected,
      isDraggable: model.isDraggable === undefined ? true : !!model.isDraggable,
      isSelectable: model.isSelectable === undefined ? true : !!model.isSelectable,
      children: buildTreeNodes(model.children || [], path),
      path,
      pathStr: JSON.stringify(path),
      level: path.length,
      ind,
      isFirstChild: ind === 0,
      isLastChild: ind === models.length - 1,
    };
  });
}

/** ノードをツリーの表示順に並べる。描画時は折りたたまれた子孫を除外できる。 */
export function flattenTree<TData>(nodes: ITreeNode<TData>[], visibleOnly = false): ITreeNode<TData>[] {
  const flattened: ITreeNode<TData>[] = [];
  for (const node of nodes) {
    flattened.push(node);
    if (!visibleOnly || node.isExpanded) flattened.push(...flattenTree(node.children, visibleOnly));
  }
  return flattened;
}

/** ノードを自分自身や自分の子孫へ移動するのを防ぐために使用する。 */
export function isSameOrDescendant<TData>(source: ITreeNode<TData>, destination: ITreeNode<TData>): boolean {
  return source.path.every((part, index) => destination.path[index] === part);
}

/** フォルダーは中央への格納を許可し、リーフは上半分と下半分で前後を判定する。 */
export function getDropPlacement(isLeaf: boolean, offsetY: number, height: number, edgeSize: number): TDropPlacement {
  if (isLeaf) return offsetY >= height / 2 ? 'after' : 'before';
  if (offsetY <= edgeSize) return 'before';
  if (offsetY >= height - edgeSize) return 'after';
  return 'inside';
}

export function selectNodes<TData>(
  nodes: ITreeNode<TData>[],
  target: ITreeNode<TData>,
  options: { additive: boolean; rangeAnchorPath?: string },
): ITreeNode<TData>[] {
  if (!target.isSelectable) return nodes.filter((node) => node.isSelected);
  if (options.rangeAnchorPath) {
    // 既存仕様に合わせ、折りたたまれた子孫も含めたツリー順で範囲選択する。
    const start = nodes.findIndex((node) => node.pathStr === options.rangeAnchorPath);
    const end = nodes.findIndex((node) => node.pathStr === target.pathStr);
    if (start !== -1 && end !== -1) {
      const from = Math.min(start, end);
      const to = Math.max(start, end);
      return nodes.filter((node, index) => index >= from && index <= to && node.isSelectable);
    }
  }
  if (options.additive) return nodes.filter((node) => node.isSelected || node.pathStr === target.pathStr);
  return [target];
}
