import { resolveTreeMove } from './tree-order';

describe('シーンツリーの並び替え', () => {
  const nodes = [
    { id: 'folder', parentId: '' },
    { id: 'a', parentId: 'folder' },
    { id: 'b', parentId: 'folder' },
    { id: 'c', parentId: '' },
  ];

  it('フォルダー内の項目を次のルート項目の直前へ出す', () => {
    expect(resolveTreeMove(nodes, ['a'], '', 'c')).toEqual({
      order: ['folder', 'b', 'a', 'c'],
      rootNodeIds: ['a'],
      parentId: '',
    });
  });

  it('フォルダーを全子孫と一緒に移動する', () => {
    const nested = [
      { id: 'folder1', parentId: '' },
      { id: 'folder2', parentId: 'folder1' },
      { id: 'a', parentId: 'folder2' },
      { id: 'b', parentId: 'folder2' },
      { id: 'c', parentId: 'folder1' },
    ];
    expect(resolveTreeMove(nested, ['folder2'], '')).toEqual({
      order: ['folder1', 'c', 'folder2', 'a', 'b'],
      rootNodeIds: ['folder2'],
      parentId: '',
    });
  });

  it('自分の子孫を親にはできない', () => {
    expect(resolveTreeMove(nodes, ['folder'], 'a')).toBeNull();
  });

  it('移動先の親と兄弟が一致しない指定を拒否する', () => {
    expect(resolveTreeMove(nodes, ['a'], 'folder', 'c')).toBeNull();
  });

  it('複数選択の表示順を保つ', () => {
    expect(resolveTreeMove(nodes, ['a', 'b'], '', 'c')?.order).toEqual(['folder', 'a', 'b', 'c']);
  });
});
