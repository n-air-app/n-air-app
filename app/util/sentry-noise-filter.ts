import type { ErrorEvent } from '@sentry/electron/renderer';

// quota 対策: ユーザー側ネット環境起因またはアプリバグに起因しないノイズを除外する
const NOISE_PATTERNS = [
  /Failed to make IPC call/,
  /ERR_ABORTED/,
  /ERR_FAILED/,
  /read ECONNRESET/,
  /network error/i,
  /Failed to fetch/,
];

function extractMessageText(event: ErrorEvent): string {
  const extra = event.extra as Record<string, unknown> | undefined;
  const candidates = [
    event.exception?.values?.[0]?.value,
    event.message,
    // console.error(msg, err) 経由の captureMessage は元の err の内容が
    // event.message には乗らず extra.exception (err.stack) 側に入るため、
    // そちらも見ないと NOISE_PATTERNS をすり抜けてしまう
    extra?.exception,
  ];
  return candidates.filter((v): v is string => typeof v === 'string').join('\n');
}

export function filterNoiseErrorEvent(event: ErrorEvent): ErrorEvent | null {
  // 診断目的で構造化して送るイベントは NOISE チェックより前に通す
  // (tags.diagnostic が設定されているものは意図的に送っているので除外しない)
  if ((event.tags as Record<string, unknown>)?.diagnostic) {
    return event;
  }

  const messageText = extractMessageText(event);
  if (NOISE_PATTERNS.some((re) => re.test(messageText))) {
    return null;
  }
  return event;
}
