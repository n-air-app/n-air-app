import { ACTIVE_HOLD_MS, canGainUp, formatGainDb, IGainGuideInput, nextGainStep, SoundActivity } from './loudness-gain';

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

describe('SoundActivity', () => {
  test('ピークが -50 dBFS を超えたら音を出しているとみなす (どれか 1 チャンネルでよい)', () => {
    const activity = new SoundActivity();
    expect(activity.update([-60, -60], 0)).toBe(false);
    expect(activity.update([-60, -40], 100)).toBe(true);
  });

  test('音が止まっても一定時間は保ち、過ぎたら false', () => {
    const activity = new SoundActivity();
    activity.update([-30], 0);
    expect(activity.update([-80], ACTIVE_HOLD_MS)).toBe(true);
    expect(activity.update([-80], ACTIVE_HOLD_MS + 1)).toBe(false);
  });

  test('チャンネルがない (空) なら音なし', () => {
    expect(new SoundActivity().update([], 0)).toBe(false);
  });
});
