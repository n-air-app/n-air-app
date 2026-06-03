import * as Sentry from '@sentry/vue';

import { IpcRequestError } from './ipc-request-error';
import { SentryReport } from './sentry-report';

export function captureIpcRequestError(
  serviceName: string,
  methodName: string | symbol,
  isHelper: boolean,
  resourceId: string | undefined,
  rpcError: { code: number; message?: string },
): IpcRequestError {
  const method = String(methodName);
  const err = new IpcRequestError(serviceName, method, rpcError);

  Sentry.addBreadcrumb({
    category: 'ipc.request',
    message: `${serviceName}.${method} failed (code: ${rpcError.code})`,
    level: 'error',
  });

  const tags: Record<string, string> = {
    isHelper: String(isHelper),
    'rpc.code': String(rpcError.code),
  };
  if (isHelper && resourceId) tags.resourceId = resourceId;

  SentryReport.error(serviceName, method, err, {
    tags,
    extra: { mainError: rpcError.message ?? '(no message)' },
    fingerprint: [err.name, serviceName, method],
  });

  return err;
}
