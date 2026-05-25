import * as Sentry from '@sentry/vue';

type SeverityLevel = 'fatal' | 'error' | 'warning' | 'log' | 'info' | 'debug';

export interface CaptureServiceErrorOpts {
  level?: SeverityLevel;
  fingerprint?: string[];
  extra?: Record<string, unknown>;
  tags?: Record<string, string>;
  context?: Record<string, Record<string, unknown> | null>;
}

export function captureServiceError(
  serviceName: string,
  methodName: string,
  error: unknown,
  opts?: CaptureServiceErrorOpts,
): void {
  Sentry.withScope((scope) => {
    scope.setLevel(opts?.level ?? 'error');
    scope.setTag('service', serviceName);
    scope.setTag('method', methodName);
    scope.setFingerprint(opts?.fingerprint ?? [serviceName, methodName, 'exception']);
    if (opts?.extra) {
      for (const [key, val] of Object.entries(opts.extra)) {
        scope.setExtra(key, val);
      }
    }
    if (opts?.tags) {
      for (const [key, val] of Object.entries(opts.tags)) {
        scope.setTag(key, val);
      }
    }
    if (opts?.context) {
      for (const [key, val] of Object.entries(opts.context)) {
        scope.setContext(key, val);
      }
    }
    Sentry.captureException(error);
  });
}

export function captureServiceMessage(
  serviceName: string,
  methodName: string,
  message: string,
  opts?: CaptureServiceErrorOpts,
): void {
  Sentry.withScope((scope) => {
    scope.setLevel(opts?.level ?? 'error');
    scope.setTag('service', serviceName);
    scope.setTag('method', methodName);
    scope.setFingerprint(opts?.fingerprint ?? [serviceName, methodName, 'exception']);
    if (opts?.extra) {
      for (const [key, val] of Object.entries(opts.extra)) {
        scope.setExtra(key, val);
      }
    }
    if (opts?.tags) {
      for (const [key, val] of Object.entries(opts.tags)) {
        scope.setTag(key, val);
      }
    }
    if (opts?.context) {
      for (const [key, val] of Object.entries(opts.context)) {
        scope.setContext(key, val);
      }
    }
    Sentry.captureMessage(message);
  });
}
