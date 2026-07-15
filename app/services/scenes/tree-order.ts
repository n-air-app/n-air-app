export interface ITreeOrderNode {
  id: string;
  parentId?: string;
}

export interface ITreeMoveResult {
  order: string[];
  rootNodeIds: string[];
  parentId: string;
}

/** ツリー構造を壊さず、対象ノードと全子孫を指定した兄弟位置へ移動した結果を返す。 */
export function resolveTreeMove(
  nodes: ITreeOrderNode[],
  nodeIds: string[],
  parentId = '',
  beforeNodeId?: string,
): ITreeMoveResult | null {
  const existingIds = new Set(nodes.map((node) => node.id));
  const rootNodeIds = nodeIds.filter((id) => existingIds.has(id));
  if (!rootNodeIds.length) return null;
  if (parentId && !existingIds.has(parentId)) return null;
  if (beforeNodeId) {
    const beforeNode = nodes.find((node) => node.id === beforeNodeId);
    if (!beforeNode || (beforeNode.parentId || '') !== parentId) return null;
  }

  const movedIds = new Set<string>();
  const collectDescendants = (nodeId: string) => {
    if (movedIds.has(nodeId)) return;
    movedIds.add(nodeId);
    nodes.filter((node) => node.parentId === nodeId).forEach((node) => collectDescendants(node.id));
  };
  rootNodeIds.forEach(collectDescendants);
  if (movedIds.has(parentId) || (beforeNodeId && movedIds.has(beforeNodeId))) return null;

  const currentIds = nodes.map((node) => node.id);
  const movedBlock = currentIds.filter((id) => movedIds.has(id));
  const remainingIds = currentIds.filter((id) => !movedIds.has(id));
  let insertionIndex = beforeNodeId ? remainingIds.indexOf(beforeNodeId) : -1;

  if (insertionIndex === -1) {
    if (!parentId) {
      insertionIndex = remainingIds.length;
    } else {
      const remainingDescendants = new Set<string>();
      const collectRemainingDescendants = (nodeId: string) => {
        nodes
          .filter((node) => !movedIds.has(node.id) && node.parentId === nodeId)
          .forEach((node) => {
            remainingDescendants.add(node.id);
            collectRemainingDescendants(node.id);
          });
      };
      collectRemainingDescendants(parentId);
      insertionIndex = Math.max(
        remainingIds.indexOf(parentId),
        ...[...remainingDescendants].map((id) => remainingIds.indexOf(id)),
      ) + 1;
    }
  }

  remainingIds.splice(insertionIndex, 0, ...movedBlock);
  return { order: remainingIds, rootNodeIds, parentId };
}
