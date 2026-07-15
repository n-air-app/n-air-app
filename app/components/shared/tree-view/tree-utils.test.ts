import { buildTreeNodes, flattenTree, getDropPlacement, isSameOrDescendant, selectNodes } from './tree-utils';

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

  it('ツリー順で追加選択と範囲選択を行う', () => {
    const nodes = flattenTree(buildTreeNodes(models));
    nodes[0].isSelected = true;
    expect(selectNodes(nodes, nodes[2], { additive: true }).map((node) => node.title)).toEqual(['folder', 'item']);
    expect(selectNodes(nodes, nodes[2], { additive: false, rangeAnchorPath: nodes[0].pathStr })
      .map((node) => node.title)).toEqual(['folder', 'child', 'item']);
  });
});
