import { IPlatformAuth } from 'services/platforms';

// 開発テスト用
export function isFakeMode(): boolean {
  return !!process.env.DEV_SERVER || !!process.env.NAIR_FAKE_PROGRAM;
}

export type FakeScheduleKind = 'none' | 'current' | 'reserved' | 'both';

/**
 * フェイクモードで初期画面に表示する番組概要のパターン
 * NAIR_FAKE_SCHEDULE=current|reserved|both|none (未指定は none)
 */
export function fakeScheduleKind(): FakeScheduleKind {
  const v = process.env.NAIR_FAKE_SCHEDULE;
  return v === 'current' || v === 'reserved' || v === 'both' ? v : 'none';
}

export const FakeModeConfig = {
  dummyComment: true,
};

export const FakeUserAuth: IPlatformAuth = {
  apiToken: 'fake',
  platform: {
    type: 'niconico',
    username: 'fake',
    token: 'fake',
    id: '2',
    userIcon: 'https://secure-dcdn.cdn.nimg.jp/nicoaccount/usericon/defaults/blank.jpg',
  },
};
