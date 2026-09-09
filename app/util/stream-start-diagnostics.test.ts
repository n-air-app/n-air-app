import * as Sentry from '@sentry/vue';

import {
  clearStreamStartFailure,
  getStreamStartFailure,
  isStreamStartFailureActive,
  noteSettingsChangeWhileFailing,
  recordStreamStartFailure,
  resetForTest,
  summarizeChangedKeys,
} from './stream-start-diagnostics';

jest.mock('@sentry/vue', () => ({
  addBreadcrumb: jest.fn(),
}));

const STORAGE_KEY = 'StreamStartNoSignalDiagnostics';

beforeEach(() => {
  localStorage.clear();
  resetForTest();
  jest.clearAllMocks();
});

const sampleSnapshot = () => ({
  platform: 'dmc',
  outputMode: 'Simple',
  video: { baseResolution: '1920x1080', outputResolution: '1280x720', bitrate: 2000, fps: '30' },
  audio: { bitrate: '128', sampleRate: 48000 },
  encoder: { type: 'obs_x264', preset: 'veryfast' },
  autoOptimize: { enabled: true, useHardwareEncoder: false },
});

test('初期状態では記録が無く、フラグも立っていない', () => {
  expect(getStreamStartFailure()).toBeNull();
  expect(isStreamStartFailureActive()).toBe(false);
});

test('recordStreamStartFailureで記録され、再度呼ぶとattemptsが積まれてfirstAtは保持される', () => {
  const snap1 = sampleSnapshot();
  recordStreamStartFailure(snap1);

  const first = getStreamStartFailure();
  expect(first).not.toBeNull();
  expect(first!.attempts).toBe(1);
  expect(first!.settings).toEqual(snap1);
  expect(isStreamStartFailureActive()).toBe(true);

  const snap2 = { ...snap1, encoder: { type: 'jim_nvenc', preset: 'p5' } };
  recordStreamStartFailure(snap2);

  const second = getStreamStartFailure();
  expect(second!.attempts).toBe(2);
  expect(second!.firstAt).toBe(first!.firstAt);
  expect(second!.settings).toEqual(snap2);
});

test('clearStreamStartFailureで記録が消える', () => {
  recordStreamStartFailure(sampleSnapshot());
  expect(isStreamStartFailureActive()).toBe(true);

  clearStreamStartFailure();

  expect(getStreamStartFailure()).toBeNull();
  expect(isStreamStartFailureActive()).toBe(false);
});

test('localStorageの値が壊れていてもnullを返し例外にならない', () => {
  localStorage.setItem(STORAGE_KEY, '{not valid json');
  expect(() => getStreamStartFailure()).not.toThrow();
  expect(getStreamStartFailure()).toBeNull();

  localStorage.setItem(STORAGE_KEY, JSON.stringify({ foo: 'bar' }));
  expect(getStreamStartFailure()).toBeNull();
});

describe('noteSettingsChangeWhileFailing', () => {
  test('フラグが立っていないときはbreadcrumbを出さない', () => {
    noteSettingsChangeWhileFailing('Output');
    expect(Sentry.addBreadcrumb).not.toHaveBeenCalled();
  });

  test('フラグが立っているときはbreadcrumbを出す', () => {
    recordStreamStartFailure(sampleSnapshot());

    noteSettingsChangeWhileFailing('Output');

    expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
      category: 'settings.change',
      message: 'Output',
      level: 'info',
    });
  });

  test('同じカテゴリの連続呼び出しは2回目以降を抑制する', () => {
    recordStreamStartFailure(sampleSnapshot());

    noteSettingsChangeWhileFailing('Output');
    noteSettingsChangeWhileFailing('Output');
    noteSettingsChangeWhileFailing('Output');

    expect(Sentry.addBreadcrumb).toHaveBeenCalledTimes(1);
  });

  test('別カテゴリに変わればまた出す', () => {
    recordStreamStartFailure(sampleSnapshot());

    noteSettingsChangeWhileFailing('Output');
    noteSettingsChangeWhileFailing('Video');
    noteSettingsChangeWhileFailing('Video');
    noteSettingsChangeWhileFailing('Output');

    expect(Sentry.addBreadcrumb).toHaveBeenCalledTimes(3);
  });
});

describe('summarizeChangedKeys', () => {
  test('どちらかがnullならunknownを返す', () => {
    expect(summarizeChangedKeys(null, sampleSnapshot())).toBe('unknown');
    expect(summarizeChangedKeys(sampleSnapshot(), null)).toBe('unknown');
    expect(summarizeChangedKeys(null, null)).toBe('unknown');
  });

  test('どちらかがundefinedでもunknownを返す(壊れたlocalStorage値でsettingsが欠けているケース)', () => {
    expect(summarizeChangedKeys(undefined, sampleSnapshot())).toBe('unknown');
    expect(summarizeChangedKeys(sampleSnapshot(), undefined)).toBe('unknown');
    expect(summarizeChangedKeys(undefined, undefined)).toBe('unknown');
  });

  test('差分が無ければnoneを返す', () => {
    const snap = sampleSnapshot();
    expect(summarizeChangedKeys(snap, { ...snap })).toBe('none');
  });

  test('ネストした差分をドット区切りソート済み文字列にする', () => {
    const before = sampleSnapshot();
    const after = {
      ...before,
      encoder: { type: 'jim_nvenc', preset: before.encoder.preset },
      video: { ...before.video, bitrate: 4000 },
    };

    expect(summarizeChangedKeys(before, after)).toBe('encoder.type,video.bitrate');
  });

  test('トップレベルの差分も検出する', () => {
    const before = sampleSnapshot();
    const after = { ...before, outputMode: 'Advanced' };

    expect(summarizeChangedKeys(before, after)).toBe('outputMode');
  });

  test('200文字を超える場合は切られる', () => {
    const before: Record<string, string> = {};
    const after: Record<string, string> = {};
    for (let i = 0; i < 50; i++) {
      before[`veryLongKeyNameForTesting${i}`] = 'a';
      after[`veryLongKeyNameForTesting${i}`] = 'b';
    }

    const summary = summarizeChangedKeys(before, after);
    expect(summary.length).toBe(200);
  });
});
