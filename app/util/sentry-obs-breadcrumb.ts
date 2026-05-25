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
