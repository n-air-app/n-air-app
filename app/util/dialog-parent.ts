/**
 * エラーダイアログ等をモーダル表示する際の親ウィンドウ解決ロジック。
 *
 * WindowsService (services/windows.ts) は Vue コンポーネントを多数 import しており
 * jest では vue transform 未設定のため直接 require できない。解決ロジックだけを
 * ここに切り出すことで、Vue import を経由せずに単体テスト可能にしている。
 */

/** getDialogParent() が実際にどこから親ウィンドウを解決したかを示す */
export type TDialogParentKind = 'child' | 'main' | 'current' | 'none';

export interface IDialogParentResolverDeps {
  isChildWindowShown(): boolean;
  getWindow(windowId: string): Electron.BrowserWindow | undefined;
  getCurrentWindow(): Electron.BrowserWindow | undefined;
}

/**
 * child ウィンドウ（設定画面等）が前面にあるときに main へ張ると裏に回り込むため、
 * child 表示中はそちらを優先する。破棄済みウィンドウへのアクセスは避ける
 * （cf. mainWindow破棄後アクセス例外の修正 4b970d6b6）。
 * どれも取れない場合は kind: 'none' を返す。呼び出し側は親なしで
 * showMessageBox(options) を呼ぶこと（scene-collections.ts に先例あり）。
 */
export function resolveDialogParent(
  deps: IDialogParentResolverDeps,
): { window: Electron.BrowserWindow | null; kind: TDialogParentKind } {
  if (deps.isChildWindowShown()) {
    const child = deps.getWindow('child');
    if (child && !child.isDestroyed()) return { window: child, kind: 'child' };
  }

  const main = deps.getWindow('main');
  if (main && !main.isDestroyed()) return { window: main, kind: 'main' };

  const current = deps.getCurrentWindow();
  if (current && !current.isDestroyed()) return { window: current, kind: 'current' };

  return { window: null, kind: 'none' };
}
