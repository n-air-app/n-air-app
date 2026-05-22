import * as Sentry from '@sentry/vue';

import { IpcRequestError } from './ipc-request-error';

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

  Sentry.withScope((scope) => {
    scope.setTag('service', serviceName);
    scope.setTag('method', method);
    scope.setTag('isHelper', String(isHelper));
    scope.setTag('rpc.code', String(rpcError.code));
    if (isHelper && resourceId) scope.setTag('resourceId', resourceId);
    scope.setExtra('mainError', rpcError.message ?? '(no message)');
    scope.setFingerprint([err.name, serviceName, method]);
    Sentry.captureException(err);
  });

  return err;
}
