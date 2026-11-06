import { FADER_MIN_DB, median, pickVoiceLevel, planAdjustment } from './loudness-adjust';

describe('pickVoiceLevel', () => {
  // 声: -25 前後と、単語の間の -45 前後を行き来する
  const speech = [-45, -44, -26, -25, -24, -46, -25, -27, -43, -24, -25, -26, -44, -25, -24, -26, -45, -25, -26, -24];

  test('声がある: 山側 (大きい方) の中央値を返す', () => {
    expect(pickVoiceLevel(speech, 5)).toBe(-25);
  });

  test('ノイズだけ (ほぼ一定) なら、-35 LUFS のような大きなノイズでも null', () => {
    const noise = Array.from({ length: 40 }, (_, i) => -35 + (i % 3) * 0.5);
    expect(pickVoiceLevel(noise, 5)).toBeNull();
  });

  test('完全な無音 (-70 以下) や空は null', () => {
    expect(pickVoiceLevel([], 5)).toBeNull();
    expect(pickVoiceLevel([-80, -90, -75], 1)).toBeNull();
  });

  test('声のサンプルが足りなければ null', () => {
    expect(pickVoiceLevel(speech, 15)).toBeNull();
  });
});

describe('planAdjustment', () => {
  test('小さすぎる: フェーダーが 0 dB ならゲインフィルタで足す', () => {
    expect(
      planAdjustment({ measuredLufs: -27, targetLufs: -15, faderDb: 0, currentGainDb: null }),
    ).toEqual({ faderDb: 0, gainDb: 12, limited: false });
  });

  test('小さすぎる: フェーダーが下がっていれば、まず 0 dB まで戻してから足りない分をゲインで足す', () => {
    // 測定 -27 (pre-fader)、フェーダー -6 → 配信上は -33。目標 -15 まで +18 必要
    expect(
      planAdjustment({ measuredLufs: -27, targetLufs: -15, faderDb: -6, currentGainDb: null }),
    ).toEqual({ faderDb: 0, gainDb: 12, limited: false });
  });

  test('小さすぎる: 既存のゲインは測定値に含まれているので、足し込む', () => {
    // 既存ゲイン +5 を含めて -22。あと +7 必要なので合計 +12
    expect(
      planAdjustment({ measuredLufs: -22, targetLufs: -15, faderDb: 0, currentGainDb: 5 }),
    ).toEqual({ faderDb: 0, gainDb: 12, limited: false });
  });

  test('小さすぎる: 推奨上限を超える分は頭打ちにして limited にする', () => {
    expect(
      planAdjustment({ measuredLufs: -45, targetLufs: -15, faderDb: 0, currentGainDb: null }),
    ).toEqual({ faderDb: 0, gainDb: 20, limited: true });
  });

  test('大きすぎる: ゲインフィルタが無ければ作らず、フェーダーだけ下げる', () => {
    expect(
      planAdjustment({ measuredLufs: -9, targetLufs: -15, faderDb: 0, currentGainDb: null }),
    ).toEqual({ faderDb: -6, gainDb: null, limited: false });
  });

  test('大きすぎる: 既存のゲインがあれば、フェーダーに触れずゲインを下げる', () => {
    // 既存ゲイン +4 を含めて -9。-6 必要 → ゲイン -2、フェーダーは 0 のまま
    expect(
      planAdjustment({ measuredLufs: -9, targetLufs: -15, faderDb: 0, currentGainDb: 4 }),
    ).toEqual({ faderDb: 0, gainDb: -2, limited: false });
  });

  test('大きすぎる: ゲインが負の値になってもよい (0 dB に戻すだけにしない)', () => {
    expect(
      planAdjustment({ measuredLufs: -5, targetLufs: -15, faderDb: 0, currentGainDb: 6 }),
    ).toEqual({ faderDb: 0, gainDb: -4, limited: false });
  });

  test('大きすぎる: ゲインの下限 (-30 dB) を超える分だけフェーダーで補う', () => {
    // 既存ゲイン 0 を含めて +30。-45 必要 → ゲイン -30 で足りない -15 をフェーダーで
    expect(
      planAdjustment({ measuredLufs: 30, targetLufs: -15, faderDb: 0, currentGainDb: 0 }),
    ).toEqual({ faderDb: -15, gainDb: -30, limited: false });
  });

  test('大きすぎる: フェーダーが下がっていて、ゲインがあれば、フェーダー込みでゲインを下げる', () => {
    // 配信上は -5 + (-3) = -8。目標 -15 まで -7。合計 = ゲイン 2 + フェーダー -3 - 7 = -8
    // → ゲインを -8 まで下げ、フェーダーは 0 に戻る
    expect(
      planAdjustment({ measuredLufs: -5, targetLufs: -15, faderDb: -3, currentGainDb: 2 }),
    ).toEqual({ faderDb: 0, gainDb: -8, limited: false });
  });

  test('大きすぎる: フェーダーは下限で止める', () => {
    expect(
      planAdjustment({ measuredLufs: 60, targetLufs: -15, faderDb: 0, currentGainDb: null }).faderDb,
    ).toBe(FADER_MIN_DB);
  });

  test('目標ちょうどなら変化なし', () => {
    expect(
      planAdjustment({ measuredLufs: -15, targetLufs: -15, faderDb: 0, currentGainDb: null }),
    ).toEqual({ faderDb: 0, gainDb: null, limited: false });
  });
});

describe('median', () => {
  test('空配列は null', () => {
    expect(median([])).toBeNull();
  });

  test('奇数個は中央の値、偶数個は中央 2 つの平均', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
  });
});
