import { SentryReport } from './sentry-report';

/**
 * Wraps a menu click handler to attach a diagnostic tag if it throws.
 * The error is re-thrown so the original unhandled-error behavior is preserved.
 *
 * Why: Menu callbacks arrive via IPC as anonymous `<object>.click` calls, making
 * it impossible to identify which handler crashed from the stack trace alone.
 */
export function withMenuHandlerTag<T>(
  name: string,
  fn: () => T,
  getExtra?: () => Record<string, unknown>,
): T {
  try {
    return fn();
  } catch (e) {
    let context: Record<string, Record<string, unknown> | null> | undefined;
    try {
      const extra = getExtra?.();
      if (extra) context = { menu: extra };
    } catch {
      // ignore failures while collecting extra context
    }
    SentryReport.error('MenuHandler', name, e, context ? { context } : undefined);
    throw e;
  }
}
