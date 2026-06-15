import {
  AllKeyDescriptions,
  EncoderFamily,
  filterKeyDescriptions,
  iterateKeyDescriptions,
  OptimizationKey,
  Optimizer,
  OptimizeSettings,
  SettingsKeyAccessor,
} from './optimizer';

type ISettingsSubCategory = import('./settings-api').ISettingsSubCategory;
jest.mock('./settings-api');
jest.mock('services/i18n', () => ({
  $t: (x: string) => x,
}));

test('filterKeyDescriptions', () => {
  const outputSimpleOnly: OptimizeSettings = {
    outputMode: 'Simple',
  };
  const simpleOnly = filterKeyDescriptions(outputSimpleOnly, AllKeyDescriptions);
  expect(simpleOnly).toEqual([
    {
      key: OptimizationKey.outputMode,
      category: 'Output',
      subCategory: 'Untitled',
      setting: 'Mode',
      lookupValueName: true,
    },
  ]);

  const qsvSettings: OptimizeSettings = {
    outputMode: 'Simple',
    simpleUseAdvanced: true,
  };
  const qsv = filterKeyDescriptions(qsvSettings, AllKeyDescriptions);
  expect(qsv).toMatchSnapshot();
});

test('SettingsKeyAccessor#traverseKeyDescriptions', () => {
  // テスト用の最小のdescriptionを用意する
  //  分岐があること
  const simpleSettings: OptimizeSettings = {
    outputMode: 'Simple',
    videoBitrate: 12345,
  };
  const simpleDescriptions = filterKeyDescriptions(simpleSettings, AllKeyDescriptions);
  expect(simpleDescriptions.length).toEqual(1);
  expect(simpleDescriptions[0].dependents).not.toBeFalsy();
  expect(simpleDescriptions[0].dependents.length).toEqual(2);

  const advancedSettings: OptimizeSettings = {
    outputMode: 'Advanced',
    videoBitrate: 12345,
  };
  const advancedDescriptions = filterKeyDescriptions(advancedSettings, AllKeyDescriptions);
  expect(advancedDescriptions.length).toEqual(1);
  expect(advancedDescriptions[0].dependents).not.toBeFalsy();
  expect(advancedDescriptions[0].dependents.length).toEqual(2);

  // アクセサのmockを作る
  let outputMode = 'Simple';
  const accessor = {
    findSettingValue: jest
      .fn()
      .mockImplementation((settings: ISettingsSubCategory[], category: string, setting: string) => {
        if (category === 'Untitled' && setting === 'Mode') {
          return outputMode;
        }
        // Simple value
        if (category === 'Streaming' && setting === 'VBitrate') {
          return 4649;
        }
        // Advanced value
        if (category === 'Streaming' && setting === 'Encoder') {
          return 'obs_x264';
        }
        if (category === 'Streaming' && setting === 'rate_control') {
          return 'CBR';
        }
        if (category === 'Streaming' && setting === 'bitrate') {
          return 2525;
        }
        return undefined;
      }),
    getSettingsFormData: jest.fn(),
    findSetting: jest.fn(),
    setSettings: jest.fn(),
  };
  const a = new SettingsKeyAccessor(accessor);

  // 分岐の選択されている側のみの値が得られること
  outputMode = 'Simple';
  const simpleResult = [...a.traverseKeyDescriptions(simpleDescriptions, (d) => [d.key, d.setting])];

  expect(accessor.findSettingValue).toHaveBeenCalledTimes(1);
  expect(accessor.findSettingValue).toHaveBeenLastCalledWith(undefined, 'Untitled', 'Mode');

  expect(simpleResult).toEqual([
    [OptimizationKey.outputMode, 'Mode'],
    [OptimizationKey.videoBitrate, 'VBitrate'],
  ]);

  outputMode = 'Advanced';
  const advancedResult = [
    ...a.traverseKeyDescriptions(advancedDescriptions, (d) => [d.key, d.setting]),
  ];
  expect(advancedResult).toEqual([
    [OptimizationKey.outputMode, 'Mode'],
    [OptimizationKey.encoder, 'Encoder'],
    [OptimizationKey.advRateControl, 'rate_control'],
    [OptimizationKey.videoBitrate, 'bitrate'],
  ]);
});

test('iterateKeyDescriptions', () => {
  const best: OptimizeSettings = {
    outputMode: 'Simple',
    videoBitrate: 5808,
    audioBitrate: '192',
    quality: '1280x720',
    fpsType: 'Common FPS Values',
    fpsCommon: '30',
    encoder: EncoderFamily.x264,
    simpleUseAdvanced: true,
    encoderPreset: 'ultrafast',
  };
  const pairs = [...iterateKeyDescriptions(best, AllKeyDescriptions)].map((desc) => [
    desc.key,
    desc.setting,
  ]);
  expect(pairs).toEqual([
    [OptimizationKey.outputMode, 'Mode'],
    [OptimizationKey.videoBitrate, 'VBitrate'],
    [OptimizationKey.encoder, 'StreamEncoder'],
    [OptimizationKey.simpleUseAdvanced, 'UseAdvanced'],
    [OptimizationKey.encoderPreset, 'Preset'],
    [OptimizationKey.audioBitrate, 'ABitrate'],
    [OptimizationKey.quality, 'Output'],
    [OptimizationKey.fpsType, 'FPSType'],
    [OptimizationKey.fpsCommon, 'FPSCommon'],
  ]);
});

test('iterateKeyDescriptions: AMD encoder', () => {
  const best: OptimizeSettings = {
    outputMode: 'Simple',
    videoBitrate: 5808,
    audioBitrate: '192',
    quality: '1280x720',
    fpsType: 'Common FPS Values',
    fpsCommon: '30',
    encoder: EncoderFamily.amd,
    simpleUseAdvanced: false,
  };
  const pairs = [...iterateKeyDescriptions(best, AllKeyDescriptions)].map((desc) => [
    desc.key,
    desc.setting,
  ]);
  expect(pairs).toEqual([
    [OptimizationKey.outputMode, 'Mode'],
    [OptimizationKey.videoBitrate, 'VBitrate'],
    [OptimizationKey.encoder, 'StreamEncoder'],
    [OptimizationKey.simpleUseAdvanced, 'UseAdvanced'],
    [OptimizationKey.audioBitrate, 'ABitrate'],
    [OptimizationKey.quality, 'Output'],
    [OptimizationKey.fpsType, 'FPSType'],
    [OptimizationKey.fpsCommon, 'FPSCommon'],
  ]);
});

test('SettingsKeyAccessor#optimizeInfo', () => {
  const current: OptimizeSettings = {
    outputMode: 'Advanced',
    encoder: EncoderFamily.x264,
    videoBitrate: 5808,
    quality: '1280x720',
    fpsType: 'Common FPS Values',
    fpsCommon: '30',
    audioBitrate: '128',
  };
  const best: OptimizeSettings = {
    outputMode: 'Simple',
    videoBitrate: 5808,
    audioBitrate: '192',
    quality: '1280x720',
    fpsType: 'Common FPS Values',
    fpsCommon: '30',
    encoder: EncoderFamily.x264,
    simpleUseAdvanced: true,
    encoderPreset: 'ultrafast',
  };
  const expectedDiff: OptimizeSettings = {
    outputMode: 'Simple',
    audioBitrate: '192',
    simpleUseAdvanced: true,
    encoderPreset: 'ultrafast',
  };
  const delta: OptimizeSettings = Object.assign({}, ...Optimizer.getDifference(current, best));
  expect(delta).toEqual(expectedDiff);

  const accessor = {
    findSettingValue: jest.fn(),
    getSettingsFormData: jest.fn(),
    findSetting: jest.fn(),
    setSettings: jest.fn(),
  };
  const a = new SettingsKeyAccessor(accessor);

  const opt = new Optimizer(a, best);
  expect(opt.optimizeInfo(current, delta)).toMatchSnapshot();
});

test.todo('Optimizer#getCurrentSettings');

// Simple/Advanced 両方 x264 の状態から最適化して Simple の StreamEncoder が QSV になることを検証
// setValues が Advanced 枝に降りて誤った設定先に書く二重降下バグの回帰防止
test('Optimizer#optimize: Simple mode x264->qsv, Advanced side must not be touched', () => {
  // Simple 側と Advanced 側を両方持つ Output フォーム
  let outputForm: ISettingsSubCategory[] = [
    {
      nameSubCategory: 'Untitled',
      parameters: [{ name: 'Mode', description: 'Mode', value: 'Simple' }],
    },
    {
      nameSubCategory: 'Streaming',
      parameters: [
        {
          name: 'StreamEncoder',
          description: 'StreamEncoder',
          value: 'obs_x264',
          options: [
            { value: 'obs_x264', description: 'x264' },
            { value: 'qsv', description: 'QSV' },
          ],
        } as any,
        {
          name: 'UseAdvanced',
          description: 'UseAdvanced',
          value: false,
          options: [
            { value: true, description: 'true' },
            { value: false, description: 'false' },
          ],
        } as any,
        {
          name: 'QSVPreset',
          description: 'QSVPreset',
          value: 'speed',
          options: [
            { value: 'quality', description: 'quality' },
            { value: 'balanced', description: 'balanced' },
            { value: 'speed', description: 'speed' },
          ],
        } as any,
        // Advanced 側エンコーダー（同一カテゴリ内に共存）
        {
          name: 'Encoder',
          description: 'Encoder',
          value: 'obs_x264',
          options: [
            { value: 'obs_x264', description: 'x264' },
            { value: 'obs_qsv11_v2', description: 'QSV' },
          ],
        } as any,
        {
          name: 'VBitrate',
          description: 'VBitrate',
          value: 5808,
        } as any,
        {
          name: 'ABitrate',
          description: 'ABitrate',
          value: '192',
        } as any,
      ],
    },
  ];
  const videoForm: ISettingsSubCategory[] = [
    {
      nameSubCategory: 'Untitled',
      parameters: [
        { name: 'Output', description: 'Output', value: '1280x720' } as any,
        { name: 'FPSType', description: 'FPSType', value: 'Common FPS Values' } as any,
        { name: 'FPSCommon', description: 'FPSCommon', value: '30' } as any,
      ],
    },
  ];
  const audioForm: ISettingsSubCategory[] = [
    {
      nameSubCategory: 'Untitled',
      parameters: [{ name: 'SampleRate', description: 'SampleRate', value: 48000 } as any],
    },
  ];

  const findParam = (form: ISettingsSubCategory[], subCat: string, name: string) => {
    for (const sub of form) {
      if (sub.nameSubCategory !== subCat) continue;
      for (const p of sub.parameters) {
        if ((p as any).name === name) return p;
      }
    }
    return undefined;
  };

  const accessor = {
    getSettingsFormData: jest.fn().mockImplementation((cat: string) => {
      if (cat === 'Output') return outputForm;
      if (cat === 'Video') return videoForm;
      if (cat === 'Audio') return audioForm;
      return [];
    }),
    findSetting: jest
      .fn()
      .mockImplementation((form: ISettingsSubCategory[], subCat: string, name: string) => {
        return findParam(form, subCat, name);
      }),
    findSettingValue: jest
      .fn()
      .mockImplementation((form: ISettingsSubCategory[], subCat: string, name: string) => {
        return (findParam(form, subCat, name) as any)?.value;
      }),
    setSettings: jest.fn().mockImplementation((cat: string, data: ISettingsSubCategory[]) => {
      if (cat === 'Output') outputForm = data;
    }),
  };

  const best: OptimizeSettings = {
    outputMode: 'Simple',
    encoder: EncoderFamily.qsv,
    simpleUseAdvanced: true,
    targetUsage: 'speed',
    videoBitrate: 5808,
    audioBitrate: '192',
    quality: '1280x720',
    fpsType: 'Common FPS Values',
    fpsCommon: '30',
    audioSampleRate: 48000,
  };

  const a = new SettingsKeyAccessor(accessor);
  const opt = new Optimizer(a, best);
  opt.optimize(best);

  // Simple 側の StreamEncoder が qsv に変わっていること
  expect(findParam(outputForm, 'Streaming', 'StreamEncoder')).toMatchObject({ value: 'qsv' });
  // 出力モードが Simple であること
  expect(findParam(outputForm, 'Untitled', 'Mode')).toMatchObject({ value: 'Simple' });
  // Advanced 側の Encoder は触られていないこと（x264 のまま）
  expect(findParam(outputForm, 'Streaming', 'Encoder')).toMatchObject({ value: 'obs_x264' });
});
