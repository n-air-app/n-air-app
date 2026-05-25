import type { SeverityLevel } from '@sentry/vue';
import * as Sentry from '@sentry/vue';

export interface SentryReportOpts {
  level?: SeverityLevel;
  fingerprint?: string[];
  extra?: Record<string, unknown>;
  tags?: Record<string, string>;
  context?: Record<string, Record<string, unknown> | null>;
}

function withServiceScope(
  serviceName: string,
  methodName: string,
  opts: SentryReportOpts | undefined,
  capture: () => void,
): void {
  Sentry.withScope((scope) => {
    scope.setLevel(opts?.level ?? 'error');
    scope.setTag('service', serviceName);
    scope.setTag('method', methodName);
    scope.setFingerprint(opts?.fingerprint ?? [serviceName, methodName, 'exception']);
    for (const [key, val] of Object.entries(opts?.extra ?? {})) scope.setExtra(key, val);
    for (const [key, val] of Object.entries(opts?.tags ?? {})) scope.setTag(key, val);
    for (const [key, val] of Object.entries(opts?.context ?? {})) scope.setContext(key, val);
    capture();
  });
}

export const SentryReport = {
  error(
    serviceName: string,
    methodName: string,
    error: unknown,
    opts?: SentryReportOpts,
  ): void {
    withServiceScope(serviceName, methodName, opts, () => Sentry.captureException(error));
  },

  message(
    serviceName: string,
    methodName: string,
    message: string,
    opts?: SentryReportOpts,
  ): void {
    withServiceScope(serviceName, methodName, opts, () => Sentry.captureMessage(message));
  },
};
