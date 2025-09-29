import { filterNoiseText } from './filterNoiseText';

describe('filterNoiseText', () => {
  const testCases = [
    { input: 'えーとこんにちは', expected: 'こんにちは' },
    { input: 'えーっとこんにちは', expected: 'こんにちは' },
    { input: 'えっとこんにちは', expected: 'こんにちは' },
    { input: 'んこんにちは', expected: 'こんにちは' },
    { input: 'こんにちは', expected: 'こんにちは' },
    { input: '', expected: '' },
    { input: 'えーと', expected: '' },
    { input: 'ん', expected: '' },
    { input: 'こんにちはえーと', expected: 'こんにちはえーと' },
  ];

  test.each(testCases)('should filter "$input" to "$expected"', ({ input, expected }) => {
    expect(filterNoiseText(input)).toBe(expected);
  });
});
