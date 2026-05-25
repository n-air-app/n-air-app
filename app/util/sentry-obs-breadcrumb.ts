import * as Sentry from '@sentry/vue';

let lastObsOp = '';

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
}
