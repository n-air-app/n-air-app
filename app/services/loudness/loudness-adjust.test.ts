import { FADER_MIN_DB, median, planAdjustment } from './loudness-adjust';

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

  test('大きすぎる: 既存のゲインがあれば 0 に戻し、残りをフェーダーで下げる', () => {
    // 既存ゲイン +4 を含めて -9。-6 必要 → 合計 -2 (ゲイン 0、フェーダー -2)
    expect(
      planAdjustment({ measuredLufs: -9, targetLufs: -15, faderDb: 0, currentGainDb: 4 }),
    ).toEqual({ faderDb: -2, gainDb: 0, limited: false });
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
