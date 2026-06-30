import * as Sentry from '@sentry/vue';

import { SentryReport } from './sentry-report';

let lastObsOp = '';

type ObsOpObserver = (op: string) => void;
let observer: ObsOpObserver | null = null;

export function setObsOpObserver(fn: ObsOpObserver | null): void {
  observer = fn;
}

export function getLastObsOp(): string {
  return lastObsOp;
}

export function markObsOp(
  serviceName: string,
  methodName: string,
  data?: Record<string, string | number | boolean>,
): void {
  const op = `${serviceName}.${methodName}`;
  lastObsOp = op;

  Sentry.addBreadcrumb({
    category: 'obs',
    message: op,
    level: 'info',
    data,
  });

  Sentry.setTag('obs.lastOp', op);
  observer?.(op);
}

export function runObsOp<T>(
  serviceName: string,
  methodName: string,
  fn: () => T,
  opts?: {
    data?: Record<string, string | number | boolean>;
    fingerprint?: string[];
    rethrow?: boolean;
  },
): T | undefined {
  markObsOp(serviceName, methodName, opts?.data);
  try {
    return fn();
  } catch (e) {
    SentryReport.error(serviceName, methodName, e, {
      level: 'error',
      fingerprint: opts?.fingerprint ?? [serviceName, methodName, 'obs', 'exception'],
    });
    if (opts?.rethrow) throw e;
    return undefined;
  }
}

const NULL_REPORT_WINDOW_MS = 60_000; // バースト連打抑制
const NULL_REPORT_MAX_PER_KEY = 5; // 継続発生時の総量上限（セッション内）

interface NullReportState {
  count: number; // これまでに送信した件数
  last: number | null; // 最後に送信した時刻。null = 一度も送信していない
}
const nullReportState = new Map<string, NullReportState>();

/**
 * OBS オブジェクトが null/undefined でないことを表明する。
 * null/undefined の場合は Sentry へ fingerprint・コンテキスト付きで報告したうえで throw する。
 *
 * 報告は 2 段の quota ガードで抑制する:
 *   1. 同一 service.method キーでセッション内 最大 NULL_REPORT_MAX_PER_KEY 件まで
 *   2. 同一キーで NULL_REPORT_WINDOW_MS (60s) に 1 件まで（バースト連打抑制）
 * throw は常時実行するため、報告抑制中でも制御フローに影響しない。
 */
export function assertObsObjectDefined<T>(
  val: T,
  serviceName: string,
  methodName: string,
  extra?: Record<string, unknown>,
): asserts val is NonNullable<T> {
  if (val !== undefined && val !== null) return; // 正常時ゼロコスト

  const key = `${serviceName}.${methodName}`;
  const state = nullReportState.get(key) ?? { count: 0, last: null };
  const now = Date.now();
  // 2 段ガード: 上限未達 かつ (初回 または 60 秒窓経過) のときだけ送信
  if (state.count < NULL_REPORT_MAX_PER_KEY && (state.last === null || now - state.last >= NULL_REPORT_WINDOW_MS)) {
    state.count += 1;
    state.last = now;
    nullReportState.set(key, state);
    const capReached = state.count >= NULL_REPORT_MAX_PER_KEY;
    SentryReport.message(serviceName, methodName, `OBS object was null/undefined in ${key}`, {
      level: 'error',
      fingerprint: [serviceName, methodName, 'obs', 'null'],
      extra: { ...extra, reportCount: state.count, ...(capReached ? { reportCapReached: true } : {}) },
    });
  }
  throw new Error(`Expected OBS object to be defined in ${key}, but received ${val}`);
}

/** テスト用: assertObsObjectDefined の報告状態をリセットする */
export function resetNullReportState(): void {
  nullReportState.clear();
}
