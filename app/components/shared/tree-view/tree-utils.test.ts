import { buildTreeNodes, flattenTree, getDropPlacement, isSameOrDescendant, resolveDropPosition, selectNodes } from './tree-utils';

const models = [
  { title: 'folder', isExpanded: true, children: [{ title: 'child', isLeaf: true }] },
  { title: 'item', isLeaf: true },
];

describe('TreeViewの操作', () => {
  it('安定したパスを生成し、表示中の階層をツリー順に並べる', () => {
    const nodes = buildTreeNodes(models);
    expect(flattenTree(nodes, true).map((node) => node.path)).toEqual([[0], [0, 0], [1]]);
  });

  it('折りたたまれたフォルダーの子孫を表示対象から除外する', () => {
    const nodes = buildTreeNodes([{ ...models[0], isExpanded: false }, models[1]]);
    expect(flattenTree(nodes, true).map((node) => node.title)).toEqual(['folder', 'item']);
  });

  it('リーフは上下、フォルダーの中央は内側へのドロップとして判定する', () => {
    expect(getDropPlacement(true, 4, 20, 3)).toBe('before');
    expect(getDropPlacement(true, 16, 20, 3)).toBe('after');
    expect(getDropPlacement(false, 10, 20, 3)).toBe('inside');
  });

  it('自分自身または自分の子孫へのドロップを拒否する', () => {
    const [folder] = buildTreeNodes(models);
    expect(isSameOrDescendant(folder, folder)).toBe(true);
    expect(isSameOrDescendant(folder, folder.children[0])).toBe(true);
    expect(isSameOrDescendant(folder.children[0], folder)).toBe(false);
  });

  it('子をルートへ出す位置を次のルートノードの直前として解決する', () => {
    const nodes = buildTreeNodes([
      { title: 'folder', children: [{ title: 'a', isLeaf: true }, { title: 'b', isLeaf: true }] },
      { title: 'c', isLeaf: true },
    ]);
    const visible = flattenTree(nodes, true);
    const position = resolveDropPosition(visible, visible, nodes[0].children[0], 'after', 1);
    expect(position.parentNode).toBeNull();
    expect(position.beforeNode?.title).toBe('c');
    expect(position.lineNode?.title).toBe('b');
    expect(position.lineLevel).toBe(1);
  });

  it('ネストした子を指定した祖先階層の末尾へ出す', () => {
    const nodes = buildTreeNodes([{
      title: 'folder1',
      children: [{ title: 'folder2', children: [{ title: 'a', isLeaf: true }] }],
    }]);
    const visible = flattenTree(nodes, true);
    const position = resolveDropPosition(visible, visible, nodes[0].children[0].children[0], 'after', 2);
    expect(position.parentNode?.title).toBe('folder1');
    expect(position.beforeNode).toBeNull();
    expect(position.lineNode?.title).toBe('a');
    expect(position.lineLevel).toBe(2);
  });

  it('ツリー順で追加選択と範囲選択を行う', () => {
    const nodes = flattenTree(buildTreeNodes(models));
    nodes[0].isSelected = true;
    expect(selectNodes(nodes, nodes[2], { additive: true }).map((node) => node.title)).toEqual(['folder', 'item']);
    expect(selectNodes(nodes, nodes[2], { additive: false, rangeAnchorPath: nodes[0].pathStr })
      .map((node) => node.title)).toEqual(['folder', 'child', 'item']);
  });
});
