import { reactive } from 'vue';

import { deepToRaw } from './stateful-service';

describe('deepToRaw', () => {
  it('プリミティブ・nullはそのまま返す', () => {
    expect(deepToRaw(1)).toBe(1);
    expect(deepToRaw('a')).toBe('a');
    expect(deepToRaw(null)).toBeNull();
    expect(deepToRaw(undefined)).toBeUndefined();
  });

  it('非reactiveな配列・オブジェクトはそのまま構造化クローン可能', () => {
    const plain = { itemsToGroup: ['a', 'b'], parentId: 'p' };
    expect(structuredClone(deepToRaw(plain))).toEqual(plain);
  });

  // N-AIR-APP-GDJ: SelectionService.getIds() は Vuex(reactive)の state 配下の
  // 配列をそのまま返すため、Proxy化された配列が ipcRenderer.send に渡ると
  // structuredClone (V8 ValueSerializer) が「An object could not be cloned.」で失敗する。
  it('reactiveなstate直下の配列はProxyのままだとstructuredCloneに失敗し、deepToRaw後は成功する', () => {
    const state = reactive({ selectedIds: ['a', 'b'] });
    const proxiedArray = state.selectedIds;

    expect(() => structuredClone(proxiedArray)).toThrow();
    expect(structuredClone(deepToRaw(proxiedArray))).toEqual(['a', 'b']);
  });

  it('queryParamsにネストしたreactive配列を含む形でもstructuredClone可能になる', () => {
    const state = reactive({ selectedIds: ['a', 'b'] });
    const options = {
      componentName: 'NameFolder',
      queryParams: { itemsToGroup: state.selectedIds, parentId: 'p' },
    };

    expect(() => structuredClone(options)).toThrow();
    expect(structuredClone(deepToRaw(options))).toEqual({
      componentName: 'NameFolder',
      queryParams: { itemsToGroup: ['a', 'b'], parentId: 'p' },
    });
  });
});
