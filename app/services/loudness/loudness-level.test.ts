import { loudnessLevel, nextOffTarget } from './loudness-level';

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

describe('nextOffTarget', () => {
  test('小さい・大きいで true、適正で false', () => {
    expect(nextOffTarget(false, 'low')).toBe(true);
    expect(nextOffTarget(false, 'high')).toBe(true);
    expect(nextOffTarget(true, 'ok')).toBe(false);
  });

  test('未確定 (無音など) では前の状態を保つ', () => {
    expect(nextOffTarget(true, 'none')).toBe(true);
    expect(nextOffTarget(false, 'none')).toBe(false);
  });
});
