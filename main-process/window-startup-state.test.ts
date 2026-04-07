import { findTargetDisplay, resolveWindowBounds } from './window-startup-state';

// electron.Screen の最小限のモック型
type MockScreen = {
  getAllDisplays: jest.Mock;
  getDisplayNearestPoint: jest.Mock;
  getPrimaryDisplay: jest.Mock;
};

function makeDisplay(x: number, y: number, width: number, height: number) {
  return {
    bounds: { x, y, width, height },
    workArea: { x, y, width, height: height - 40 }, // タスクバー分を引いた近似値
  };
}

function makeScreen(displays: ReturnType<typeof makeDisplay>[]): MockScreen {
  const primary = displays[0];
  return {
    getAllDisplays: jest.fn(() => displays),
    getDisplayNearestPoint: jest.fn(({ x, y }: { x: number; y: number }) => {
      // 最近接ディスプレイを返す（中心距離で判定）
      return displays.reduce((nearest, d) => {
        const cx = d.bounds.x + d.bounds.width / 2;
        const cy = d.bounds.y + d.bounds.height / 2;
        const ncx = nearest.bounds.x + nearest.bounds.width / 2;
        const ncy = nearest.bounds.y + nearest.bounds.height / 2;
        return Math.hypot(x - cx, y - cy) < Math.hypot(x - ncx, y - ncy) ? d : nearest;
      });
    }),
    getPrimaryDisplay: jest.fn(() => primary),
  };
}

const displayA = makeDisplay(0, 0, 1920, 1080);
const displayB = makeDisplay(1920, 0, 1920, 1080);

describe('findTargetDisplay', () => {
  test('displayBounds が一致するディスプレイを返す', () => {
    const screen = makeScreen([displayA, displayB]);
    const result = findTargetDisplay(
      { x: 1920, y: 0, width: 1920, height: 1080 },
      undefined,
      undefined,
      screen,
    );
    expect(result).toBe(displayB);
  });

  test('displayBounds が一致しない場合は中心点から最近接を返す（モニター切断時）', () => {
    const screen = makeScreen([displayA]); // displayB が切断された状態
    const result = findTargetDisplay(
      { x: 1920, y: 0, width: 1920, height: 1080 },
      undefined,
      undefined,
      screen,
    );
    expect(result).toBe(displayA);
    expect(screen.getDisplayNearestPoint).toHaveBeenCalledWith({ x: 2880, y: 540 });
  });

  test('displayBounds が undefined の場合は savedX/Y から最近接を返す', () => {
    const screen = makeScreen([displayA, displayB]);
    const result = findTargetDisplay(undefined, 1950, 100, screen);
    expect(result).toBe(displayB);
    expect(screen.getDisplayNearestPoint).toHaveBeenCalledWith({ x: 1950, y: 100 });
  });

  test('displayBounds も savedX/Y も undefined の場合はプライマリを返す', () => {
    const screen = makeScreen([displayA, displayB]);
    const result = findTargetDisplay(undefined, undefined, undefined, screen);
    expect(result).toBe(displayA);
    expect(screen.getPrimaryDisplay).toHaveBeenCalled();
  });
});

describe('resolveWindowBounds', () => {
  test('通常モード・同モニター: 保存された x/y がそのまま返る', () => {
    const screen = makeScreen([displayA, displayB]);
    const result = resolveWindowBounds(
      { x: 100, y: 50, width: 1600, height: 1000, isMaximized: false },
      { x: 100, y: 50, width: 1600, height: 1000 },
      screen,
    );
    expect(result).toEqual({ x: 100, y: 50, width: 1600, height: 1000, shouldMaximize: false });
  });

  test('最大化・同モニター: displayBounds で同モニターを特定し workArea 中央 + shouldMaximize=true', () => {
    const screen = makeScreen([displayA, displayB]);
    // モニターAで最大化していた: displayBounds はモニターA
    const result = resolveWindowBounds(
      {
        x: 100,
        y: 50,
        width: 1600,
        height: 1000,
        isMaximized: true,
        displayBounds: { x: 0, y: 0, width: 1920, height: 1080 },
      },
      { x: 100, y: 50, width: 1600, height: 1000 },
      screen,
    );
    const workArea = displayA.workArea;
    const expectedWidth = Math.min(1600, workArea.width);
    const expectedHeight = Math.min(1000, workArea.height);
    expect(result).toEqual({
      x: workArea.x + Math.round((workArea.width - expectedWidth) / 2),
      y: workArea.y + Math.round((workArea.height - expectedHeight) / 2),
      width: expectedWidth,
      height: expectedHeight,
      shouldMaximize: true,
    });
  });

  test('最大化・別モニターに移動: displayBounds でモニターBを特定し Bの workArea 中央 + shouldMaximize=true', () => {
    const screen = makeScreen([displayA, displayB]);
    // モニターAで通常モード、その後モニターBに移動して最大化:
    // x/y はモニターAの古い値のまま、displayBounds はモニターB
    const result = resolveWindowBounds(
      {
        x: 100,
        y: 50,
        width: 1600,
        height: 1000,
        isMaximized: true,
        displayBounds: { x: 1920, y: 0, width: 1920, height: 1080 },
      },
      { x: 100, y: 50, width: 1600, height: 1000 },
      screen,
    );
    const workArea = displayB.workArea;
    const expectedWidth = Math.min(1600, workArea.width);
    const expectedHeight = Math.min(1000, workArea.height);
    expect(result.shouldMaximize).toBe(true);
    expect(result.x).toBe(workArea.x + Math.round((workArea.width - expectedWidth) / 2));
    expect(result.y).toBe(workArea.y + Math.round((workArea.height - expectedHeight) / 2));
  });

  test('最大化 + モニター切断: displayBounds が一致しないが残存モニターに最大化で復元される', () => {
    // モニターBで最大化して終了 → モニターBを切断して再起動
    // この時 electron-window-state の validateState() が resetStateToDefault() を呼ぶ可能性があるが、
    // rawSavedState は保持されているため isMaximized=true と displayBounds は使える
    const screen = makeScreen([displayA]); // displayB が切断された状態

    // rawSavedState は切断前の状態を持つ（window-state.json から直接読んだ値）
    const result = resolveWindowBounds(
      {
        x: 1920 + 100,
        y: 50,
        width: 1600,
        height: 1000,
        isMaximized: true,
        displayBounds: { x: 1920, y: 0, width: 1920, height: 1080 },
      },
      // windowState は resetStateToDefault() の影響でデフォルト値になっている可能性がある
      { x: 0, y: 0, width: 1600, height: 1000 },
      screen,
    );
    expect(result.shouldMaximize).toBe(true);
    // 残存モニター（displayA）の workArea 内に配置されること
    const workArea = displayA.workArea;
    expect(result.x).toBeGreaterThanOrEqual(workArea.x);
    expect(result.y).toBeGreaterThanOrEqual(workArea.y);
  });

  test('通常モード + モニター切断: x/y が画面外 → x/y=undefined でデフォルト配置', () => {
    // モニターBで通常モード → モニターB切断 → 再起動
    const screen = makeScreen([displayA]); // displayB が切断された状態
    const result = resolveWindowBounds(
      { x: 1920 + 100, y: 50, width: 1600, height: 1000, isMaximized: false },
      { x: 1920 + 100, y: 50, width: 1600, height: 1000 },
      screen,
    );
    expect(result.x).toBeUndefined();
    expect(result.y).toBeUndefined();
    expect(result.shouldMaximize).toBe(false);
  });

  test('初回起動（空の rawSavedState）: デフォルトサイズ・shouldMaximize=false', () => {
    const screen = makeScreen([displayA]);
    const result = resolveWindowBounds(
      {}, // rawSavedState が空 = window-state.json が存在しない
      { x: 0, y: 0, width: 1600, height: 1000 },
      screen,
    );
    expect(result.shouldMaximize).toBe(false);
    expect(result.width).toBe(1600);
    expect(result.height).toBe(1000);
  });

  test('displayBounds が undefined の最大化: savedX/Y からフォールバックで最近接ディスプレイ', () => {
    const screen = makeScreen([displayA, displayB]);
    const result = resolveWindowBounds(
      { x: 1950, y: 100, width: 1600, height: 1000, isMaximized: true, displayBounds: undefined },
      { x: 1950, y: 100, width: 1600, height: 1000 },
      screen,
    );
    expect(result.shouldMaximize).toBe(true);
    // displayBounds が undefined なので savedX/Y (1950, 100) からモニターBを特定
    const workArea = displayB.workArea;
    expect(result.x).toBeGreaterThanOrEqual(workArea.x);
  });
});
