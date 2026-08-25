/** @jest-environment jsdom */

import { clearTreeCursor, updateTreeCursor } from './tree-cursor';
import { buildTreeNodes } from './tree-utils';

function createTreeRoot() {
  const root = document.createElement('div');
  root.innerHTML = `
    <div class="tree-view-node">
      <div class="tree-view-cursor tree-view-cursor_before"></div>
      <div class="tree-view-node-item" data-tree-path="[0]"></div>
      <div class="tree-view-cursor tree-view-cursor_after"></div>
    </div>
    <div class="tree-view-node">
      <div class="tree-view-cursor tree-view-cursor_before"></div>
      <div class="tree-view-node-item" data-tree-path="[1]"></div>
      <div class="tree-view-cursor tree-view-cursor_after"></div>
    </div>
  `;
  return root;
}

function getNodeItem(root: HTMLElement, path: string) {
  return Array.from(root.querySelectorAll<HTMLElement>('[data-tree-path]'))
    .find((item) => item.dataset.treePath === path)!;
}

describe('TreeViewのドラッグカーソル', () => {
  const nodes = buildTreeNodes([
    { title: 'folder', children: [] },
    { title: 'item', isLeaf: true },
  ]);

  it('指定した行の境界にカーソルを表示する', () => {
    const root = createTreeRoot();
    updateTreeCursor(root, {
      node: nodes[1],
      placement: 'before',
      parentNode: null,
      beforeNode: nodes[1],
      lineNode: nodes[1],
      linePlacement: 'before',
      lineLevel: 1,
    });

    const cursor = getNodeItem(root, nodes[1].pathStr).parentElement!
      .querySelector<HTMLElement>('.tree-view-cursor_before')!;
    expect(cursor.style.visibility).toBe('visible');
    expect(cursor.style.getPropertyValue('--depth')).toBe('0');
  });

  it('フォルダー内へのドロップ対象だけを強調する', () => {
    const root = createTreeRoot();
    updateTreeCursor(root, {
      node: nodes[0],
      placement: 'inside',
      parentNode: nodes[0],
      beforeNode: null,
    });

    expect(getNodeItem(root, nodes[0].pathStr).classList.contains('tree-view-cursor-inside')).toBe(true);
    expect(root.querySelector('.tree-view-cursor[style*="visible"]')).toBeNull();
  });

  it('移動前の表示を消して新しい位置だけを表示する', () => {
    const root = createTreeRoot();
    updateTreeCursor(root, {
      node: nodes[0],
      placement: 'inside',
      parentNode: nodes[0],
      beforeNode: null,
    });
    updateTreeCursor(root, {
      node: nodes[1],
      placement: 'after',
      parentNode: null,
      beforeNode: null,
      lineNode: nodes[1],
      linePlacement: 'after',
      lineLevel: 1,
    });

    expect(getNodeItem(root, nodes[0].pathStr).classList.contains('tree-view-cursor-inside')).toBe(false);
    expect(root.querySelectorAll('.tree-view-cursor[style*="visible"]')).toHaveLength(1);

    clearTreeCursor(root);
    expect(root.querySelector('.tree-view-cursor[style*="visible"]')).toBeNull();
  });
});
