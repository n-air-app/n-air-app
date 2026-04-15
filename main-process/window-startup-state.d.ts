export interface Display {
  bounds: { x: number; y: number; width: number; height: number };
  workArea: { x: number; y: number; width: number; height: number };
}

export interface Screen {
  getAllDisplays(): Display[];
  getDisplayNearestPoint(point: { x: number; y: number }): Display;
  getPrimaryDisplay(): Display;
}

export interface SavedState {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  isMaximized?: boolean;
  displayBounds?: { x: number; y: number; width: number; height: number };
}

export interface WindowState {
  x: number | undefined;
  y: number | undefined;
  width: number;
  height: number;
}

export interface WindowBounds {
  x?: number;
  y?: number;
  width: number;
  height: number;
  shouldMaximize: boolean;
}

export function findTargetDisplay(
  savedDisplayBounds: SavedState['displayBounds'],
  savedX: number | undefined,
  savedY: number | undefined,
  screen: Screen,
): Display;

export function resolveWindowBounds(
  rawSavedState: SavedState,
  windowState: WindowState,
  screen: Screen,
  defaults?: { defaultWidth: number; defaultHeight: number },
): WindowBounds;
