import { loudnessLevel, nextQuiet } from './loudness-level';

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
