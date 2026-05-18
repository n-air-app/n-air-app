import * as remote from '@electron/remote';
import { Subscription } from 'rxjs';
import { InitAfter } from 'services/core';
import { SelectionService } from 'services/selection';

import * as obs from '../../obs-api';
import { ScalableRectangle } from '../util/ScalableRectangle';

import { Inject } from './core/injector';
import { Service } from './core/service';
import { SettingsService } from './settings';
import { VideoSettingsService } from './settings-v2';
import Utils from './utils';
import { WindowsService } from './windows';

const DISPLAY_ELEMENT_INITIAL_DELAY = 50;
const DISPLAY_ELEMENT_POLLING_INTERVAL = 500;

export interface IDisplayOptions {
  sourceId?: string;
  paddingSize?: number;
  renderingMode?: number;
}

export class Display {
  @Inject() settingsService: SettingsService;
  @Inject() videoService: VideoService;
  @Inject() windowsService: WindowsService;
  @Inject() selectionService: SelectionService;

  outputRegionCallbacks: Function[];
  outputRegion: IRectangle;
  isDestroyed = false;

  trackingInitialTimeout: ReturnType<typeof setTimeout>;
  trackingInterval: number;
  currentPosition: IRectangle = {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  };

  electronWindowId: number;
  windowId: string;

  private readonly selectionSubscription: Subscription;

  sourceId: string;
  renderingMode: number;

  boundDestroy: any;
  boundClose: any;
  displayDestroyed: boolean;

  constructor(public name: string, options: IDisplayOptions = {}) {
    this.sourceId = options.sourceId;
    this.electronWindowId = remote.getCurrentWindow().id;

    this.windowId = Utils.getCurrentUrlParams().windowId;
    this.renderingMode = options.renderingMode
      ? options.renderingMode
      : obs.ERenderingMode.OBS_MAIN_RENDERING;

    const electronWindow = remote.BrowserWindow.fromId(this.electronWindowId);

    this.videoService.createOBSDisplay(
      this.electronWindowId,
      name,
      this.renderingMode,
      this.sourceId,
    );

    this.displayDestroyed = false;

    this.selectionSubscription = this.selectionService.updated.subscribe((state) => {
      this.switchGridlines(state.selectedIds.length <= 1);
    });

    // 映像部分以外の色
    this.videoService.setOBSDisplayPaddingColor(name, 31, 34, 45);

    // ソースの枠線の色
    // this.videoService.setOBSDisplayPaddingColor(name, 255, 105, 82);

    // ソースから十字に伸びる線の色
    // this.videoService.setOBSDisplayPaddingColor(name, 255, 105, 82);

    if (options.paddingSize != null) {
      this.videoService.setOBSDisplayPaddingSize(name, options.paddingSize);
    }

    this.outputRegionCallbacks = [];

    this.boundClose = this.remoteClose.bind(this);

    electronWindow.on('close', this.boundClose);
  }

  /**
   * Will keep the display positioned on top of the passed HTML element
   * @param element the html element to host the display
   */
  trackElement(element: HTMLElement) {
    if (this.trackingInterval) clearInterval(this.trackingInterval);

    const trackingFun = () => {
      if (this.displayDestroyed) return;

      const rect = this.getScaledRectangle(element.getBoundingClientRect());

      if (
        rect.x !== this.currentPosition.x
        || rect.y !== this.currentPosition.y
        || rect.width !== this.currentPosition.width
        || rect.height !== this.currentPosition.height
      ) {
        this.move(rect.x, rect.y);
        this.resize(rect.width, rect.height);
      }
    };

    this.trackingInitialTimeout = setTimeout(() => {
      trackingFun();
      this.trackingInitialTimeout = null;
    }, DISPLAY_ELEMENT_INITIAL_DELAY); // ここで実行するとまだOBS側の状態が整っていないので初回の位置がずれるため、延期する
    this.trackingInterval = window.setInterval(trackingFun, DISPLAY_ELEMENT_POLLING_INTERVAL);
  }

  getScaledRectangle(rect: ClientRect): IRectangle {
    const factor: number = this.windowsService.state[this.windowId].scaleFactor;

    return {
      x: rect.left * factor,
      y: rect.top * factor,
      width: rect.width * factor,
      height: rect.height * factor,
    };
  }

  move(x: number, y: number) {
    this.currentPosition.x = x;
    this.currentPosition.y = y;
    this.videoService.moveOBSDisplay(this.name, x, y);
  }

  resize(width: number, height: number) {
    this.currentPosition.width = width;
    this.currentPosition.height = height;
    this.videoService.resizeOBSDisplay(this.name, width, height);
    if (this.outputRegionCallbacks.length) this.refreshOutputRegion();
  }

  remoteClose() {
    if (this.displayDestroyed) return;
    this.displayDestroyed = true;

    this.outputRegionCallbacks = [];
    if (this.trackingInitialTimeout) {
      clearTimeout(this.trackingInitialTimeout);
      this.trackingInitialTimeout = null;
    }
    if (this.trackingInterval) {
      clearInterval(this.trackingInterval);
      this.trackingInterval = null;
    }
    if (this.selectionSubscription) this.selectionSubscription.unsubscribe();
    this.videoService.destroyOBSDisplay(this.name);
  }

  destroy() {
    const win = remote.BrowserWindow.fromId(this.electronWindowId);
    if (win) win.removeListener('close', this.boundClose);
    this.remoteClose();
  }

  onOutputResize(cb: (region: IRectangle) => void) {
    this.outputRegionCallbacks.push(cb);
  }

  async refreshOutputRegion() {
    if (this.displayDestroyed) return;

    const position = this.videoService.getOBSDisplayPreviewOffset(this.name);

    // This can happen while we were async fetching the offset
    if (this.displayDestroyed) return;

    const size = this.videoService.getOBSDisplayPreviewSize(this.name);

    this.outputRegion = {
      ...position,
      ...size,
    };

    this.outputRegionCallbacks.forEach((cb) => {
      cb(this.outputRegion);
    });
  }

  drawingUI = true;

  setShoulddrawUI(drawUI: boolean) {
    this.drawingUI = drawUI;
    this.videoService.setOBSDisplayShouldDrawUI(this.name, drawUI);
  }

  switchGridlines(enabled: boolean) {
    // This function does nothing if we aren't drawing the UI
    if (!this.drawingUI) return;
    this.videoService.setOBSDisplayDrawGuideLines(this.name, enabled);
  }
}

@InitAfter('VideoSettingsService')
export class VideoService extends Service {
  @Inject() settingsService: SettingsService;
  @Inject() videoSettingsService: VideoSettingsService;

  init() {
    this.settingsService.loadSettingsIntoStore();
  }

  getScreenRectangle() {
    return new ScalableRectangle({
      x: 0,
      y: 0,
      width: this.baseWidth,
      height: this.baseHeight,
    });
  }

  get baseWidth() {
    return this.baseResolution.width;
  }

  get baseHeight() {
    return this.baseResolution.height;
  }

  get baseResolution() {
    const baseResolutions = this.videoSettingsService.baseResolutions;
    return {
      width: baseResolutions.horizontal.baseWidth,
      height: baseResolutions.horizontal.baseHeight,
    };
    // const [widthStr, heightStr] = this.settingsService.state.Video.Base.split('x');
    // const width = parseInt(widthStr, 10);
    // const height = parseInt(heightStr, 10);

    // return {
    //   width,
    //   height,
    // };
  }

  setBaseResolution(resolution: { width: number; height: number }) {
    this.settingsService.setSettingValue(
      'Video',
      'Base',
      `${resolution.width}x${resolution.height}`,
    );
  }

  /**
   * @warning DO NOT USE THIS METHOD. Use the Display class instead
   */
  createOBSDisplay(
    electronWindowId: number,
    name: string,
    renderingMode: number,
    sourceId?: string,
  ) {
    const electronWindow = remote.BrowserWindow.fromId(electronWindowId);
    const context = this.videoSettingsService.contexts.horizontal;

    if (sourceId) {
      obs.NodeObs.OBS_content_createSourcePreviewDisplay(
        electronWindow.getNativeWindowHandle(),
        sourceId,
        name,
        false,
        context,
      );
    } else {
      obs.NodeObs.OBS_content_createDisplay(
        electronWindow.getNativeWindowHandle(),
        name,
        renderingMode,
        false,
        context,
      );
    }
  }

  setOBSDisplayPaddingColor(name: string, r: number, g: number, b: number) {
    obs.NodeObs.OBS_content_setPaddingColor(name, r, g, b);
  }

  setOBSDisplayPaddingSize(name: string, size: number) {
    obs.NodeObs.OBS_content_setPaddingSize(name, size);
  }

  moveOBSDisplay(name: string, x: number, y: number) {
    try {
      obs.NodeObs.OBS_content_moveDisplay(name, x, y);
    } catch (e) {
      if (isKnownDisplayRaceError(e)) {
        console.warn('[VideoService] moveOBSDisplay:', e.message);
        return;
      }
      throw e;
    }
  }

  resizeOBSDisplay(name: string, width: number, height: number) {
    try {
      obs.NodeObs.OBS_content_resizeDisplay(name, width, height);
    } catch (e) {
      if (isKnownDisplayRaceError(e)) {
        console.warn('[VideoService] resizeOBSDisplay:', e.message);
        return;
      }
      throw e;
    }
  }

  destroyOBSDisplay(name: string) {
    try {
      obs.NodeObs.OBS_content_destroyDisplay(name);
    } catch (e) {
      if (isKnownDisplayRaceError(e)) {
        console.warn('[VideoService] destroyOBSDisplay:', e.message);
        return;
      }
      throw e;
    }
  }

  getOBSDisplayPreviewOffset(name: string): IVec2 {
    try {
      return obs.NodeObs.OBS_content_getDisplayPreviewOffset(name);
    } catch (e) {
      if (isKnownDisplayRaceError(e)) {
        console.warn('[VideoService] getOBSDisplayPreviewOffset:', e.message);
        return { x: 0, y: 0 };
      }
      throw e;
    }
  }

  getOBSDisplayPreviewSize(name: string): { width: number; height: number } {
    try {
      return obs.NodeObs.OBS_content_getDisplayPreviewSize(name);
    } catch (e) {
      if (isKnownDisplayRaceError(e)) {
        console.warn('[VideoService] getOBSDisplayPreviewSize:', e.message);
        return { width: 0, height: 0 };
      }
      throw e;
    }
  }

  setOBSDisplayShouldDrawUI(name: string, drawUI: boolean) {
    obs.NodeObs.OBS_content_setShouldDrawUI(name, drawUI);
  }

  setOBSDisplayDrawGuideLines(name: string, drawGuideLines: boolean) {
    obs.NodeObs.OBS_content_setDrawGuideLines(name, drawGuideLines);
  }
}

/**
 * obs-studio-node が display map にキーが無いときに投げる既知のレースエラーを判定する。
 * これらは操作の前後でウィンドウが閉じられた際に発生する競合状態であり、致命的エラーではない。
 */
function isKnownDisplayRaceError(e: unknown): e is Error {
  if (!(e instanceof Error)) return false;
  return (
    e.message.startsWith('Invalid key provided to moveDisplay:') ||
    e.message.startsWith('Failed to find key for destruction:')
  );
}
