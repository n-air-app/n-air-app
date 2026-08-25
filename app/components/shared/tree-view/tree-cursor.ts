import { ITreeCursorPosition } from './types';

const visibleCursorSelector = '.tree-view-cursor[style*="visible"]';
const insideCursorSelector = '.tree-view-cursor-inside';

export function clearTreeCursor(root: HTMLElement) {
  root.querySelector<HTMLElement>(visibleCursorSelector)?.style.removeProperty('visibility');
  root.querySelector<HTMLElement>(insideCursorSelector)?.classList.remove('tree-view-cursor-inside');
}

export function updateTreeCursor<TData>(root: HTMLElement, position: ITreeCursorPosition<TData>) {
  clearTreeCursor(root);
  const nodeItems = Array.from(root.querySelectorAll<HTMLElement>('[data-tree-path]'));
  const targetItem = nodeItems.find((item) => item.dataset.treePath === position.node.pathStr);
  if (position.placement === 'inside') targetItem?.classList.add('tree-view-cursor-inside');

  const lineNode = position.lineNode || position.node;
  const linePlacement = position.linePlacement || position.placement;
  if (linePlacement === 'inside') return;
  const lineItem = nodeItems.find((item) => item.dataset.treePath === lineNode.pathStr);
  const cursor = lineItem?.parentElement?.querySelector<HTMLElement>(`.tree-view-cursor_${linePlacement}`);
  if (!cursor) return;
  cursor.style.visibility = 'visible';
  cursor.style.setProperty('--depth', String((position.lineLevel || lineNode.level) - 1));
}
