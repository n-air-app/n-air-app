/**
 * 保存された displayBounds から対応する現在接続中のディスプレイを見つける。
 *
 * electron-window-state は最大化中に x/y を更新しないため、保存された x/y は
 * 最大化前の古いモニター位置を指している可能性がある。
 * displayBounds は最大化時にも正しく更新されるため、復元先モニターの特定に使う。
 *
 * @param {({x: number, y: number, width: number, height: number})|undefined} savedDisplayBounds
 * @param {number|undefined} savedX - フォールバック用の保存された x 座標
 * @param {number|undefined} savedY - フォールバック用の保存された y 座標
 * @param {{ getAllDisplays(): Electron.Display[], getDisplayNearestPoint(point: {x:number,y:number}): Electron.Display, getPrimaryDisplay(): Electron.Display }} screen
 * @returns {Electron.Display}
 */
function findTargetDisplay(savedDisplayBounds, savedX, savedY, screen) {
  if (savedDisplayBounds) {
    // 保存された位置と一致するディスプレイを探す
    const allDisplays = screen.getAllDisplays();
    const match = allDisplays.find(
      d => d.bounds.x === savedDisplayBounds.x && d.bounds.y === savedDisplayBounds.y,
    );
    if (match) return match;
    // 完全一致がなければ中心点から最近接ディスプレイを返す（モニター切断時のフォールバック）
    const center = {
      x: savedDisplayBounds.x + savedDisplayBounds.width / 2,
      y: savedDisplayBounds.y + savedDisplayBounds.height / 2,
    };
    return screen.getDisplayNearestPoint(center);
  }
  if (Number.isInteger(savedX) && Number.isInteger(savedY)) {
    return screen.getDisplayNearestPoint({ x: savedX, y: savedY });
  }
  return screen.getPrimaryDisplay();
}

/**
 * 保存状態からウィンドウの初期位置・サイズ・最大化フラグを決定する。
 *
 * rawSavedState を使う理由:
 * electron-window-state の validateState() → resetStateToDefault() は保存された x/y が
 * どのディスプレイにも含まれない場合に state を上書きし、isMaximized と元の displayBounds を
 * 消してしまう。そのため windowStateKeeper() 呼び出し前に window-state.json を直接読んだ
 * rawSavedState を最大化・ディスプレイ判定に使う。
 *
 * @param {{ x?: number, y?: number, width?: number, height?: number, isMaximized?: boolean, displayBounds?: { x: number, y: number, width: number, height: number } }} rawSavedState - window-state.json の生データ（{}の場合は初回起動扱い）
 * @param {{ x: number|undefined, y: number|undefined, width: number, height: number }} windowState
 *   - windowStateKeeper が返す値（validateState() 後の値なので isMaximized/displayBounds が消える可能性あり）
 * @param {{ getAllDisplays(): Electron.Display[], getDisplayNearestPoint(point: {x:number,y:number}): Electron.Display, getPrimaryDisplay(): Electron.Display }} screen
 * @param {{ defaultWidth: number, defaultHeight: number }} [defaults]
 * @returns {{ x?: number, y?: number, width: number, height: number, shouldMaximize: boolean }}
 */
function resolveWindowBounds(rawSavedState, windowState, screen, defaults) {
  const defaultWidth = defaults?.defaultWidth ?? 1600;
  const defaultHeight = defaults?.defaultHeight ?? 1000;

  if (rawSavedState.isMaximized) {
    // 最大化状態で復元する場合: rawSavedState の displayBounds から正しいモニターを特定して配置する。
    // x/y は最大化前の古い値（別モニターの可能性あり）なので使わない。
    const targetDisplay = findTargetDisplay(
      rawSavedState.displayBounds,
      rawSavedState.x,
      rawSavedState.y,
      screen,
    );
    const workArea = targetDisplay.workArea;
    const width = Math.min(windowState.width || rawSavedState.width || defaultWidth, workArea.width);
    const height = Math.min(
      windowState.height || rawSavedState.height || defaultHeight,
      workArea.height,
    );
    // maximize() 前の配置はターゲットディスプレイの workArea 中央に置く
    return {
      x: workArea.x + Math.round((workArea.width - width) / 2),
      y: workArea.y + Math.round((workArea.height - height) / 2),
      width,
      height,
      shouldMaximize: true,
    };
  }

  // 通常状態で復元する場合: 保存された x/y が有効なディスプレイ上にあるか確認する
  const hasPosition = Number.isInteger(windowState.x) && Number.isInteger(windowState.y);
  const allDisplays = screen.getAllDisplays();
  const isVisible =
    hasPosition &&
    allDisplays.some(
      display =>
        display.workArea.x < windowState.x + windowState.width &&
        windowState.x < display.workArea.x + display.workArea.width &&
        display.workArea.y < windowState.y &&
        windowState.y < display.workArea.y + display.workArea.height,
    );

  return {
    ...(isVisible ? { x: windowState.x, y: windowState.y } : {}),
    // isVisible が false の場合は x/y を省略し、Electron がプライマリディスプレイ中央に配置する
    width: windowState.width,
    height: windowState.height,
    shouldMaximize: false,
  };
}

module.exports = { findTargetDisplay, resolveWindowBounds };
