import debounce from 'lodash/debounce';
import { Subject } from 'rxjs';
import { Inject } from 'services/core/injector';
import { SettingsService } from 'services/settings';
import { getKeys } from 'util/getKeys';
import { markObsOp } from 'util/sentry-obs-breadcrumb';

import { EColorSpace, EFPSType, ERangeType, EScaleType, EVideoFormat, IVideo, IVideoInfo, Video, VideoFactory } from '../../../obs-api';
import { mutation, StatefulService } from '../core/stateful-service';

/**
 * Display Types
 *
 * Add display type options by adding the display name to the displays array
 * and the context name to the context name map.
 */
//const displays = ['horizontal', 'vertical'] as const;
const displays = ['horizontal'] as const;
export type TDisplayType = (typeof displays)[number];

export interface IVideoSetting {
  horizontal: IVideoInfo | null;
  //  vertical: IVideoInfo | null;
}

export interface IVideoSettingFormatted {
  baseRes: string;
  outputRes: string;
  scaleType: EScaleType;
  fpsType: EFPSType;
  fpsCom: string;
  fpsNum: number;
  fpsDen: number;
  fpsInt: number;
}

export enum ESettingsVideoProperties {
  'baseRes' = 'Base',
  'outputRes' = 'Output',
  'scaleType' = 'ScaleType',
  'fpsType' = 'FPSType',
  'fpsCom' = 'FPSCommon',
  'fpsNum' = 'FPSNum',
  'fpsDen' = 'FPSDen',
  'fpsInt' = 'FPSInt',
}
export function invalidFps(num: number, den: number) {
  return num / den > 1000 || num / den < 1;
}

/**
 * 2つの IVideoInfo が全フィールドで一致するかどうかを判定する。
 * refrectLegacy で不要な SetVideoContext 呼び出しを抑制するために使用。
 */
export function isVideoInfoEqual(a: IVideoInfo | null | undefined, b: IVideoInfo | null | undefined): boolean {
  if (a == null || b == null) return a == null && b == null;
  const aKeys = getKeys(a);
  const bKeys = getKeys(b);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((key) => a[key] === b[key]);
}

export class VideoSettingsService extends StatefulService<IVideoSetting> {
  //@Inject() dualOutputService: DualOutputService;
  @Inject() settingsService: SettingsService;

  initialState = {
    horizontal: null as IVideoInfo | null,
    //  vertical: null as IVideoInfo | null,
  };

  establishedContext = new Subject<void>();

  init() {
    this.establishVideoContext();

    // if (this.dualOutputService.views.activeDisplays.vertical) {
    //   this.establishVideoContext('vertical');
    // }

    this.establishedContext.next();
  }

  contexts = {
    horizontal: null as IVideo | null,
    //    vertical: null as IVideo | null,
  };

  get values() {
    return {
      horizontal: this.formatVideoSettings('horizontal'),
      //      vertical: this.formatVideoSettings('vertical'),
    };
  }

  /**
   * The below conditionals are to prevent undefined errors on app startup
   */
  get baseResolutions() {
    // this.state.horizontal は migrateSettings() で補正済みの値を持つ。
    // settingsService.state.Video.Base（OBS raw 値）は初回起動時に '0x0' を返すことがあるため使わない。
    const stateWidth = this.state.horizontal?.baseWidth;
    const stateHeight = this.state.horizontal?.baseHeight;
    if (!stateWidth || !stateHeight) {
      console.warn('[VideoSettingsService] baseResolutions: state is not ready, using fallback. state=', this.state.horizontal);
    }
    const baseWidth = stateWidth || 1920;
    const baseHeight = stateHeight || 1080;

    return {
      horizontal: { baseWidth, baseHeight },
      // vertical: { baseWidth, baseHeight },
    };
    // // const videoSettings = this.dualOutputService.views.videoSettings;
    // const [widthStr, heightStr] = this.settingsService.views.values.Video.Base.split('x');

    // // to prevent any possible undefined errors on load in the event that the root node
    // // attempts to load before the first video context has finished establishing
    // // the below are fallback dimensions
    // const defaultWidth = widthStr ? parseInt(widthStr, 10) : 1920;
    // const defaultHeight = heightStr ? parseInt(heightStr, 10) : 1080;

    // const horizontalWidth = videoSettings?.horizontal
    //   ? videoSettings.horizontal?.baseWidth
    //   : defaultWidth;
    // const horizontalHeight = videoSettings.horizontal
    //   ? videoSettings.horizontal?.baseHeight
    //   : defaultHeight;

    // const verticalWidth = videoSettings.vertical.baseWidth ?? defaultWidth;
    // const verticalHeight = videoSettings.vertical.baseHeight ?? defaultHeight;

    // return {
    //   horizontal: {
    //     baseWidth: horizontalWidth ?? this.contexts.horizontal?.video.baseWidth,
    //     baseHeight: horizontalHeight ?? this.contexts.horizontal?.video.baseHeight,
    //   },
    //   vertical: {
    //     baseWidth: verticalWidth ?? this.contexts.vertical?.video.baseWidth,
    //     baseHeight: verticalHeight ?? this.contexts.vertical?.video.baseHeight,
    //   },
    // };
  }

  /**
   * Format video settings for the video settings form
   *
   * @param display - Optional, the display for the settings
   * @returns Settings formatted for the video settings form
   */
  formatVideoSettings(display: TDisplayType = 'horizontal') {
    // use vertical display setting as a failsafe to prevent null errors
    const settings = this.contexts[display]?.video; //??
    // this.dualOutputService.views.videoSettings[display] ??
    // this.dualOutputService.views.videoSettings.vertical;

    return {
      baseRes: `${settings?.baseWidth}x${settings?.baseHeight}`,
      outputRes: `${settings?.outputWidth}x${settings?.outputHeight}`,
      scaleType: settings?.scaleType,
      fpsType: settings?.fpsType,
      fpsCom: `${settings?.fpsNum}-${settings?.fpsDen}`,
      fpsNum: settings?.fpsNum,
      fpsDen: settings?.fpsDen,
      fpsInt: settings?.fpsNum,
    };
  }

  /**
   * Load legacy video settings from cache.
   *
   * @remarks
   * Ideally, the first time the user opens the app after the settings
    * have migrated to being stored on the front end, load the settings from
    * the legacy settings. Because the legacy settings are just values from basic.ini
    * if the user is starting from a clean cache, there will be no such file.
    * In that case, load from the video property.

    * Additionally, because this service is loaded lazily, calling this function elsewhere
    * before the service has been initiated will call the function twice.
    * To prevent errors, just return if both properties are null because
    * the function will be called again as a part of establishing the context.
   * @param display - Optional, the context's display name
   */

  // loadLegacySettings(display: TDisplayType = 'horizontal') {
  //   const legacySettings = this.contexts[display]?.legacySettings;
  //   const videoSettings = this.contexts[display]?.video;

  //   if (!legacySettings && !videoSettings) return;

  //   if (legacySettings?.baseHeight === 0 || legacySettings?.baseWidth === 0) {
  //     // return if null for the same reason as above
  //     if (!videoSettings) return;

  //     Object.keys(videoSettings).forEach((key: keyof IVideoInfo) => {
  //       this.SET_VIDEO_SETTING(key, videoSettings[key]);
  //       this.dualOutputService.setVideoSetting({ [key]: videoSettings[key] }, display);
  //     });
  //   } else {
  //     // return if null for the same reason as above
  //     if (!legacySettings) return;
  //     Object.keys(legacySettings).forEach((key: keyof IVideoInfo) => {
  //       this.SET_VIDEO_SETTING(key, legacySettings[key]);
  //       this.dualOutputService.setVideoSetting({ [key]: legacySettings[key] }, display);
  //     });
  //     this.contexts[display].video = this.contexts[display].legacySettings;
  //   }
  // }

  /**
   * Migrate settings from legacy settings or obs
   *
   * @param display - Optional, the context's display name
   */
  migrateSettings(display: TDisplayType = 'horizontal') {
    // osn 0.26.28 では IVideo.video への代入が SetVideoContext を呼び出し、
    // outputWidth=0 または outputHeight=0 の場合にエラーをthrowするようになった。
    // basic.ini の OutputCX=0, OutputCY=0 の場合（初回起動やキャッシュクリア後）に
    // legacySettings の outputWidth/outputHeight が 0 になるため、
    // 代入前にデフォルト値で補完する。
    // BaseCX/BaseCY は 1280/720 でも OutputCX/OutputCY が 0 の場合があるため
    // baseWidth/baseHeight だけでなく outputWidth/outputHeight もチェックする。
    // 参考: streamlabs/desktop の同様の修正
    const legacy = this.contexts.horizontal!.legacySettings;
    if (!legacy.baseWidth || !legacy.baseHeight || !legacy.outputWidth || !legacy.outputHeight) {
      const defaultVideoInfo: IVideoInfo = {
        fpsNum: legacy.fpsNum || 30,
        fpsDen: legacy.fpsDen || 1,
        baseWidth: legacy.baseWidth || 1280,
        baseHeight: legacy.baseHeight || 720,
        outputWidth: legacy.outputWidth || legacy.baseWidth || 1280,
        outputHeight: legacy.outputHeight || legacy.baseHeight || 720,
        outputFormat: legacy.outputFormat ?? EVideoFormat.I420,
        colorspace: legacy.colorspace ?? EColorSpace.CS709,
        range: legacy.range ?? ERangeType.Full,
        scaleType: legacy.scaleType ?? EScaleType.Bilinear,
        fpsType: legacy.fpsType ?? EFPSType.Integer,
      };
      getKeys(defaultVideoInfo).forEach((key) => {
        this.SET_VIDEO_SETTING(key, defaultVideoInfo[key], 'horizontal');
      });
      // legacySettings も更新して以降の代入でエラーが出ないようにする
      this.contexts.horizontal!.legacySettings = defaultVideoInfo;
    }

    // legacySettings を video に反映（この時点で outputWidth/outputHeight は非ゼロ）
    this.contexts.horizontal!.video = this.contexts.horizontal!.legacySettings;

    if (invalidFps(this.contexts[display]!.video.fpsNum, this.contexts[display]!.video.fpsDen)) {
      this.createDefaultFps(display);
    }

    this.SET_VIDEO_CONTEXT(display, this.contexts[display]!.video);
  }

  /**
   * Establish the obs video context
   *
   * @remarks
   * Many startup errors in other services will result from a context not being established before
   * the service initiates.
   *
   * @param display - Optional, the context's display name
   * @returns Boolean denoting success
   */
  establishVideoContext(display: TDisplayType = 'horizontal') {
    if (this.contexts[display]) return;
    this.SET_VIDEO_CONTEXT(display);
    this.contexts[display] = VideoFactory.create();
    this.migrateSettings(display);

    this.contexts[display]!.video = this.state[display]!;
    this.contexts[display]!.legacySettings = this.state[display]!;
    Video.video = this.state.horizontal!;
    Video.legacySettings = this.state.horizontal!;

    return !!this.contexts[display];
  }

  createDefaultFps(display: TDisplayType = 'horizontal') {
    this.setVideoSetting('fpsNum', 30, display);
    this.setVideoSetting('fpsDen', 1, display);
  }

  private updateObsSettingsImpl(display: TDisplayType = 'horizontal') {
    this.contexts[display]!.video = this.state[display]!;
    this.contexts[display]!.legacySettings = this.state[display]!;
  }

  private debouncedUpdateObsSettings = debounce(this.updateObsSettingsImpl, 200);

  updateObsSettings(display: TDisplayType = 'horizontal') {
    this.debouncedUpdateObsSettings(display);
  }

  setVideoSetting(key: string, value: unknown, display: TDisplayType = 'horizontal') {
    this.SET_VIDEO_SETTING(key, value, display);
    this.updateObsSettings(display);

    // also update the persisted settings
    //    this.dualOutputService.setVideoSetting({ [key]: value }, display);
  }

  // 現状settingsの情報はlegacyにあるのでそれを反映させる
  refrectLegacy(display: TDisplayType = 'horizontal') {
    const legacySettings = this.contexts[display]!.legacySettings;

    // osn 0.26.28 では SetVideoContext(0x0) がエラーをthrowするようになった。
    // legacySettings の outputWidth/outputHeight が 0 の場合はデフォルト値で補完する。
    const safeSettings: IVideoInfo = {
      ...legacySettings,
      baseWidth: legacySettings.baseWidth || 1280,
      baseHeight: legacySettings.baseHeight || 720,
      outputWidth: legacySettings.outputWidth || legacySettings.baseWidth || 1280,
      outputHeight: legacySettings.outputHeight || legacySettings.baseHeight || 720,
    };

    // A案: 値が実際に変化した場合のみ video context を更新する。
    // osn 0.26.28 では配信中に SetVideoContext を呼ぶと IPC エラーが発生するため、
    // 同値再設定（シーンコレクション切替などで解像度が変わらない場合）をスキップする。
    const current = this.contexts[display]!.video;
    if (!isVideoInfoEqual(current, safeSettings)) {
      // C案: try/catch で囲み、osn の video context エラーを warn 格下げする安全網。
      // A案で同値ケースは除外済みのため、ここに来るのは値が実際に変化した場合のみ。
      try {
        this.contexts[display]!.video = safeSettings;
      } catch (e) {
        markObsOp('VideoSettingsService', 'refrectLegacy', {
          display,
          error: e instanceof Error ? e.message : String(e),
        });
        console.warn('[VideoSettingsService] refrectLegacy: failed to set video context:', e);
        // 配信中の video context 再設定エラーはダイアログを出さず warn 格下げとする
      }
    }

    getKeys(safeSettings).forEach((key) => {
      this.SET_VIDEO_SETTING(key, safeSettings[key], 'horizontal');
    });
  }

  /**
   * Shut down the video settings service
   *
   * @remarks
   * Each context must be destroyed when shutting down the app to prevent errors
   */
  shutdown() {
    this.debouncedUpdateObsSettings.cancel();

    displays.forEach((display) => {
      const context = this.contexts[display];
      if (!context) return;

      // OBS IPC が切断済みでも、1つのネイティブ呼び出しの失敗で残りの
      // シャットダウン処理を中断しない。各処理を独立して試行し、フロント側の
      // コンテキストは必ず破棄する。
      try {
        context.legacySettings = this.state[display]!;
      } catch (e) {
        this.reportShutdownError(display, 'saveLegacySettings', e);
      }

      try {
        context.destroy();
      } catch (e) {
        this.reportShutdownError(display, 'destroyContext', e);
      } finally {
        this.contexts[display] = null;
        this.DESTROY_VIDEO_CONTEXT(display);
      }
    });
  }

  private reportShutdownError(
    display: TDisplayType,
    operation: 'saveLegacySettings' | 'destroyContext',
    error: unknown,
  ) {
    markObsOp('VideoSettingsService', 'shutdown', {
      display,
      operation,
      error: error instanceof Error ? error.message : String(error),
    });
    console.error(`[VideoSettingsService] shutdown(${display}): ${operation} failed:`, error);
  }

  @mutation()
  DESTROY_VIDEO_CONTEXT(display: TDisplayType = 'horizontal') {
    this.state[display] = null;
  }

  @mutation()
  SET_VIDEO_SETTING(key: string, value: unknown, display: TDisplayType = 'horizontal') {
    this.state[display] = {
      ...this.state[display]!,
      [key]: value,
    } as IVideoInfo;
  }

  @mutation()
  SET_VIDEO_CONTEXT(display: TDisplayType = 'horizontal', settings?: IVideoInfo) {
    if (settings) {
      this.state[display] = settings;
    } else {
      this.state[display] = {} as IVideoInfo;
    }
  }

  @mutation()
  REMOVE_CONTEXT(display: TDisplayType) {
    this.state[display] = null;
  }
}
