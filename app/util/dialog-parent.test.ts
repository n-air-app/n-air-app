import { resolveDialogParent } from './dialog-parent';

function makeWindow(id: string, destroyed = false) {
  return { id, isDestroyed: () => destroyed } as unknown as Electron.BrowserWindow;
}

describe('resolveDialogParent', () => {
  test('child ウィンドウが表示中ならそれを親にする', () => {
    const child = makeWindow('child');
    const result = resolveDialogParent({
      isChildWindowShown: () => true,
      getWindow: (id) => (id === 'child' ? child : makeWindow('main')),
      getCurrentWindow: () => makeWindow('current'),
    });
    expect(result).toEqual({ window: child, kind: 'child' });
  });

  test('child が表示中でも取得できない/破棄済みなら main にフォールバックする', () => {
    const main = makeWindow('main');
    const result = resolveDialogParent({
      isChildWindowShown: () => true,
      getWindow: (id) => (id === 'main' ? main : undefined),
      getCurrentWindow: () => makeWindow('current'),
    });
    expect(result).toEqual({ window: main, kind: 'main' });
  });

  test('child が破棄済みなら main にフォールバックする', () => {
    const destroyedChild = makeWindow('child', true);
    const main = makeWindow('main');
    const result = resolveDialogParent({
      isChildWindowShown: () => true,
      getWindow: (id) => (id === 'child' ? destroyedChild : main),
      getCurrentWindow: () => makeWindow('current'),
    });
    expect(result).toEqual({ window: main, kind: 'main' });
  });

  test('child が非表示なら main を親にする', () => {
    const main = makeWindow('main');
    const result = resolveDialogParent({
      isChildWindowShown: () => false,
      getWindow: (id) => (id === 'main' ? main : undefined),
      getCurrentWindow: () => makeWindow('current'),
    });
    expect(result).toEqual({ window: main, kind: 'main' });
  });

  test('main が取得できない場合は getCurrentWindow を親にする', () => {
    const current = makeWindow('current');
    const result = resolveDialogParent({
      isChildWindowShown: () => false,
      getWindow: () => undefined,
      getCurrentWindow: () => current,
    });
    expect(result).toEqual({ window: current, kind: 'current' });
  });

  test('main が破棄済みの場合は getCurrentWindow を親にする', () => {
    const destroyedMain = makeWindow('main', true);
    const current = makeWindow('current');
    const result = resolveDialogParent({
      isChildWindowShown: () => false,
      getWindow: () => destroyedMain,
      getCurrentWindow: () => current,
    });
    expect(result).toEqual({ window: current, kind: 'current' });
  });

  test('どれも取得できない場合は window: null, kind: none を返す', () => {
    const result = resolveDialogParent({
      isChildWindowShown: () => false,
      getWindow: () => undefined,
      getCurrentWindow: () => undefined,
    });
    expect(result).toEqual({ window: null, kind: 'none' });
  });

  test('getCurrentWindow が破棄済みの場合も window: null, kind: none を返す', () => {
    const result = resolveDialogParent({
      isChildWindowShown: () => false,
      getWindow: () => undefined,
      getCurrentWindow: () => makeWindow('current', true),
    });
    expect(result).toEqual({ window: null, kind: 'none' });
  });
});
