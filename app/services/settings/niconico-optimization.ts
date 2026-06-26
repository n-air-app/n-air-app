import { EncoderFamily, OptimizationKey, OptimizeSettings, SettingsKeyAccessor } from './optimizer';

/** ニコニコ生放送が推奨する解像度段。大きい順。 */
export const NICONICO_RESOLUTIONS: { w: number; h: number }[] = [
  { w: 1920, h: 1080 },
  { w: 1280, h: 720 },
  { w: 800, h: 450 },
  { w: 512, h: 288 },
];

/**
 * recommended をキャンバス解像度 (baseW x baseH) に収まる最大の推奨段へクランプする。
 * 収まる段が無い場合は最小段を返す。
 */
export function clampResolutionToCanvas(
  recommended: { w: number; h: number },
  baseW: number,
  baseH: number,
): { w: number; h: number } {
  if (recommended.w <= baseW && recommended.h <= baseH) {
    return recommended;
  }
  const fitting = NICONICO_RESOLUTIONS.find((r) => r.w <= baseW && r.h <= baseH);
  return fitting ?? NICONICO_RESOLUTIONS[NICONICO_RESOLUTIONS.length - 1];
}

/** 番組の height からニコニコ推奨解像度を返す（キャンバスによるクランプ前） */
export function getRecommendedResolutionForHeight(height: number): { w: number; h: number } {
  switch (height) {
    case 1080:
      return { w: 1920, h: 1080 };
    case 720:
      return { w: 1280, h: 720 };
    case 450:
      return { w: 800, h: 450 };
    case 288:
    default:
      return { w: 512, h: 288 };
  }
}

/**
 * niconicoに最適な設定値を返す。
 */
export function getBestSettingsForNiconico(
  options: {
    bitrate: number;
    height: number;
    fps: number;
    useHardwareEncoder?: boolean;
    baseWidth?: number;
    baseHeight?: number;
  },
  settings: SettingsKeyAccessor,
): OptimizeSettings {
  let audioBitrate: number;
  if (options.bitrate >= 6000) {
    audioBitrate = 192;
  } else if (options.bitrate >= 2000) {
    audioBitrate = 192;
  } else if (options.bitrate >= 1000) {
    audioBitrate = 96;
  } else if (options.bitrate >= 384) {
    audioBitrate = 48;
  } else {
    audioBitrate = 48;
  }

  let resolutionValue = getRecommendedResolutionForHeight(options.height);

  if (options.baseWidth && options.baseHeight) {
    resolutionValue = clampResolutionToCanvas(resolutionValue, options.baseWidth, options.baseHeight);
  }
  const resolution = `${resolutionValue.w}x${resolutionValue.h}`;

  let encoderSettings: OptimizeSettings = {
    encoder: EncoderFamily.x264,
    simpleUseAdvanced: true,
    encoderPreset: 'ultrafast',
  };
  if (!('useHardwareEncoder' in options) || options.useHardwareEncoder) {
    if (settings.hasSpecificValue(OptimizationKey.encoder, EncoderFamily.nvencH264Tex)) {
      encoderSettings = {
        encoder: EncoderFamily.nvencH264Tex,
        simpleUseAdvanced: true,
        NVENCPreset2: 'p3',
      };
    } else if (settings.hasSpecificValue(OptimizationKey.encoder, EncoderFamily.nvencNew)) {
      encoderSettings = {
        encoder: EncoderFamily.nvencNew,
        simpleUseAdvanced: true,
        NVENCPreset2: 'p3',
      };
    } else if (
      settings.hasSpecificValue(OptimizationKey.encoder, EncoderFamily.nvenc)
      || settings.hasSpecificValue(OptimizationKey.encoder, EncoderFamily.advancedNvenc)
    ) {
      encoderSettings = {
        encoder: EncoderFamily.nvenc,
        simpleUseAdvanced: true,
        NVENCPreset2: 'p3',
      };
    } else if (settings.hasSpecificValue(OptimizationKey.encoder, EncoderFamily.amd)) {
      encoderSettings = {
        encoder: EncoderFamily.amd,
        simpleUseAdvanced: false,
      };
    } else if (
      settings.hasSpecificValue(OptimizationKey.encoder, EncoderFamily.qsv)
      || settings.hasSpecificValue(OptimizationKey.encoder, EncoderFamily.qsvNew)
      || settings.hasSpecificValue(OptimizationKey.encoder, EncoderFamily.advancedQsv)
    ) {
      encoderSettings = {
        encoder: EncoderFamily.qsv,
        simpleUseAdvanced: true,
        targetUsage: 'speed',
      };
    }
  }

  const commonSettings: OptimizeSettings = {
    outputMode: 'Simple',
    videoBitrate: options.bitrate - audioBitrate,
    audioBitrate: audioBitrate.toString(10),
    quality: resolution,
    fpsType: 'Common FPS Values',
    fpsCommon: `${options.fps || 30}`,
    audioSampleRate: 48000,
  };

  // 出力=詳細(Output: Advanced) のときのエンコーダー以外の設定
  const advancedSettings: OptimizeSettings = {
    outputMode: 'Advanced',
    advRateControl: 'CBR',
    advColorSpace: '709',
    advKeyframeInterval: 300,
    advProfile: 'high',
    advAudioTrackIndex: '1',
  };

  return {
    ...commonSettings,
    // ...advancedSettings, // #239 のワークアラウンドでコメントアウト: 出力=詳細が最適化に使える様になったときに有効にしたい
    ...encoderSettings,
  };
}
