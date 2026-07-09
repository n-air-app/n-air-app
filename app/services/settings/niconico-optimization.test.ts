import { TObsFormData, TObsValue } from 'components/obs/inputs/ObsInput';

import { clampResolutionToCanvas, getBestSettingsForNiconico } from './niconico-optimization';
import {
  EncoderFamily,
  ISettingsAccessor,
  OptimizationKey,
  OptimizeSettings,
  SettingsKeyAccessor,
} from './optimizer';
import { ISettingsSubCategory } from './settings-api';

jest.mock('./settings-api');
jest.mock('services/i18n', () => ({
  $t: (x: string) => x,
}));

const outputSettings: ISettingsSubCategory[] = [
  {
    nameSubCategory: 'Untitled',
    parameters: [
      {
        name: 'Mode',
        description: 'outputMode',
        value: 'Simple',
      },
    ],
  },
  {
    nameSubCategory: 'Streaming',
    parameters: [
      {
        name: 'StreamEncoder',
        description: 'StreamEncoder',
        value: 'qsv',
        options: [{ value: 'qsv', description: 'qsv' }],
      },
    ],
  },
];

const outputSettingsAmd: ISettingsSubCategory[] = [
  {
    nameSubCategory: 'Untitled',
    parameters: [
      {
        name: 'Mode',
        description: 'outputMode',
        value: 'Simple',
      },
    ],
  },
  {
    nameSubCategory: 'Streaming',
    parameters: [
      {
        name: 'StreamEncoder',
        description: 'StreamEncoder',
        value: 'amd',
        options: [{ value: 'amd', description: 'amd' }],
      },
    ],
  },
];

class MockSettingAccessor implements ISettingsAccessor {
  getSettingsFormData(categoryName: string): ISettingsSubCategory[] {
    if (categoryName === 'Output') {
      return outputSettings;
    }
    return [];
  }
  findSetting(
    settings: ISettingsSubCategory[],
    category: string,
    setting: string,
  ): TObsFormData[number] | undefined {
    for (const subCategory of settings) {
      if (subCategory.nameSubCategory !== category) continue;
      for (const parameter of subCategory.parameters) {
        if (parameter.name === setting) return parameter;
      }
    }
    return undefined;
  }
  findSettingValue(
    settings: ISettingsSubCategory[],
    category: string,
    setting: string,
  ): TObsValue | undefined {
    return this.findSetting(settings, category, setting)?.value;
  }
  setSettings(_categoryName: string, _settingsData: ISettingsSubCategory[]): void {}
}

test('mock outputSettings', () => {
  const settings = new SettingsKeyAccessor(new MockSettingAccessor());
  expect(settings.hasSpecificValue(OptimizationKey.encoder, EncoderFamily.qsv)).toBe(true);
});

describe('getBestSettingsForNiconico', () => {
  class MockSettingAccessorAmd extends MockSettingAccessor {
    getSettingsFormData(categoryName: string): ISettingsSubCategory[] {
      if (categoryName === 'Output') {
        return outputSettingsAmd;
      }
      return [];
    }
  }

  const accessor = new SettingsKeyAccessor(new MockSettingAccessor());
  const accessorAmd = new SettingsKeyAccessor(new MockSettingAccessorAmd());
  const commonSettings: Partial<OptimizeSettings> = {
    simpleUseAdvanced: true,
    audioSampleRate: 48000,
    fpsCommon: '30',
    fpsType: 'Common FPS Values',
    outputMode: 'Simple',
  };
  const x264Settings: Partial<OptimizeSettings> = {
    ...commonSettings,
    encoder: EncoderFamily.x264,
    encoderPreset: 'ultrafast',
  };
  const qsvSettings: Partial<OptimizeSettings> = {
    ...commonSettings,
    encoder: EncoderFamily.qsv,
    targetUsage: 'speed',
  };
  const amdSettings: Partial<OptimizeSettings> = {
    ...commonSettings,
    simpleUseAdvanced: false,
    encoder: EncoderFamily.amd,
  };

  test.each([
    [
      1000,
      288,
      30,
      false,
      { ...x264Settings, quality: '512x288', audioBitrate: '96', videoBitrate: 1000 - 96 },
    ],
    [
      2000,
      450,
      30,
      false,
      { ...x264Settings, quality: '800x450', audioBitrate: '192', videoBitrate: 2000 - 192 },
    ],
    [
      4000,
      720,
      30,
      false,
      { ...x264Settings, quality: '1280x720', audioBitrate: '192', videoBitrate: 4000 - 192 },
    ],
    [
      6000,
      1080,
      60,
      true,
      {
        ...qsvSettings,
        quality: '1920x1080',
        audioBitrate: '192',
        videoBitrate: 6000 - 192,
        fpsCommon: '60',
      },
    ],
  ])(
    'bitrate: %p, height: %p, fps: %p, useHardwareEncoder: %p',
    (bitrate, height, fps, useHardwareEncoder, shouldBe) => {
      const settings = getBestSettingsForNiconico(
        { bitrate, height, fps, useHardwareEncoder },
        accessor,
      );
      expect(settings).toEqual(shouldBe);
    },
  );
  test('AMD encoder is selected when available', () => {
    const settings = getBestSettingsForNiconico(
      { bitrate: 6000, height: 1080, fps: 30 },
      accessorAmd,
    );
    expect(settings).toEqual({
      ...amdSettings,
      quality: '1920x1080',
      audioBitrate: '192',
      videoBitrate: 6000 - 192,
    });
  });

  test('does not clamp quality when baseWidth/baseHeight are not given (backward compatibility)', () => {
    const settings = getBestSettingsForNiconico(
      { bitrate: 6000, height: 1080, fps: 30, useHardwareEncoder: false },
      accessor,
    );
    expect(settings.quality).toBe('1920x1080');
  });

  test('clamps quality to canvas resolution when it is smaller than the recommended resolution', () => {
    const settings = getBestSettingsForNiconico(
      {
        bitrate: 6000, height: 1080, fps: 30, useHardwareEncoder: false, baseWidth: 1280, baseHeight: 720,
      },
      accessor,
    );
    expect(settings.quality).toBe('1280x720');
  });

  test('does not clamp quality when canvas resolution is large enough', () => {
    const settings = getBestSettingsForNiconico(
      {
        bitrate: 6000, height: 1080, fps: 30, useHardwareEncoder: false, baseWidth: 1920, baseHeight: 1080,
      },
      accessor,
    );
    expect(settings.quality).toBe('1920x1080');
  });
});

describe('clampResolutionToCanvas', () => {
  test('clamps to the largest recommended resolution that fits the canvas', () => {
    expect(clampResolutionToCanvas({ w: 1920, h: 1080 }, 1280, 720)).toEqual({ w: 1280, h: 720 });
  });

  test('returns the recommended resolution unchanged when it fits the canvas', () => {
    expect(clampResolutionToCanvas({ w: 1280, h: 720 }, 1920, 1080)).toEqual({ w: 1280, h: 720 });
  });

  test('falls back to the smallest resolution when nothing fits the canvas', () => {
    expect(clampResolutionToCanvas({ w: 1280, h: 720 }, 640, 360)).toEqual({ w: 512, h: 288 });
  });
});
