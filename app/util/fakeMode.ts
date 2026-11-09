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

/** フェイクモードの番組概要。NAIR_FAKE_SCHEDULE で表示パターンを選ぶ */
export function fakeScheduleSummary(now = Math.floor(Date.now() / 1000)) {
  const kind = fakeScheduleKind();
  return {
    current: kind === 'current' || kind === 'both'
      ? {
        nicoliveProgramId: 'lvDEBUG1',
        status: 'onAir' as const,
        title: 'DEBUG放送中の番組',
        onAirBeginAt: now - 30 * 60,
        onAirEndAt: now + 30 * 60,
      }
      : null,
    reserved: kind === 'reserved' || kind === 'both'
      ? {
        nicoliveProgramId: 'lvDEBUG2',
        status: 'reserved' as const,
        title: 'DEBUG予約番組',
        onAirBeginAt: now + 24 * 60 * 60,
        onAirEndAt: now + 25 * 60 * 60,
      }
      : null,
  };
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
