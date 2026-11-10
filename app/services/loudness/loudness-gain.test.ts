import { canGainUp, formatGainDb, IGainGuideInput, loudnessLevel, nextGainStep, nextQuiet } from './loudness-gain';

describe('loudnessLevel', () => {
  test.each<[number | null, string]>([
    [null, 'none'],
    [-15, 'ok'],
    [-18, 'ok'],
    [-12, 'ok'],
    [-18.1, 'low'],
    [-11.9, 'high'],
  ])('%p (目標 -15) => %s', (shortTerm, expected) => {
    expect(loudnessLevel(shortTerm, -15)).toBe(expected);
  });
});

describe('nextQuiet', () => {
  test('小さいで true、適正・大きいで false', () => {
    expect(nextQuiet(false, 'low')).toBe(true);
    expect(nextQuiet(true, 'ok')).toBe(false);
    expect(nextQuiet(true, 'high')).toBe(false);
  });

  test('未確定 (無音など) では前の状態を保つ', () => {
    expect(nextQuiet(true, 'none')).toBe(true);
    expect(nextQuiet(false, 'none')).toBe(false);
  });
});

describe('nextGainStep', () => {
  test.each<[number, number | null]>([
    [0, 6],
    [-3, 6],
    [3, 6],
    [6, 12],
    [5.999, 12],
    [12, 20],
    [15, 20],
    [20, null],
    [25, null],
  ])('%d => %p', (current, expected) => {
    expect(nextGainStep(current)).toBe(expected);
  });
});

describe('formatGainDb', () => {
  test('符号付きで、整数はそのまま、端数は小数 1 桁', () => {
    expect(formatGainDb(12)).toBe('+12');
    expect(formatGainDb(7.5)).toBe('+7.5');
    expect(formatGainDb(-3)).toBe('-3');
    expect(formatGainDb(0)).toBe('0');
  });
});

describe('canGainUp', () => {
  const input = (patch: Partial<IGainGuideInput> = {}): IGainGuideInput => ({
    quiet: true,
    active: true,
    muted: false,
    faderDb: 0,
    gainDb: 0,
    ...patch,
  });

  test('配信音声が小さく、フェーダーが最大なら上げられる', () => {
    expect(canGainUp(input())).toBe(true);
    expect(canGainUp(input({ gainDb: 12 }))).toBe(true);
  });

  test('配信音声が小さくなければ案内しない', () => {
    expect(canGainUp(input({ quiet: false }))).toBe(false);
  });

  test('フェーダーが下がっていれば、まずフェーダーで上げてもらう', () => {
    expect(canGainUp(input({ faderDb: -6 }))).toBe(false);
    expect(canGainUp(input({ faderDb: -0.5 }))).toBe(true);
  });

  test('ミュート中や、音を出していないソースには案内しない', () => {
    expect(canGainUp(input({ muted: true }))).toBe(false);
    expect(canGainUp(input({ active: false }))).toBe(false);
  });

  test('ゲインが上限なら出さない', () => {
    expect(canGainUp(input({ gainDb: 20 }))).toBe(false);
  });
});
