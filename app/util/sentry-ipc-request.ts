import * as Sentry from '@sentry/vue';

import { IpcRequestError } from './ipc-request-error';
import { isObsBackendIpcLostMessage } from './obs-ipc-error';
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
  // OBS バックエンドIPC切断（既知の未解決issue: n-air-app#1380）は原因不明の他エラーとは
  // 分離・降格する。アプリ側に再接続機構がない
  const isObsBackendIpcLost = isObsBackendIpcLostMessage(rpcError.message);

  Sentry.addBreadcrumb({
    category: 'ipc.request',
    message: `${serviceName}.${method} failed (code: ${rpcError.code})`,
    level: isObsBackendIpcLost ? 'warning' : 'error',
  });

  const tags: Record<string, string> = {
    isHelper: String(isHelper),
    'rpc.code': String(rpcError.code),
    'ipc.mainErrorKind': isObsBackendIpcLost ? 'obsBackendIpcLost' : 'other',
  };
  if (isHelper && resourceId) tags.resourceId = resourceId;

  SentryReport.error(serviceName, method, err, {
    tags,
    extra: { mainError: rpcError.message ?? '(no message)' },
    // err.name は minify でチャンクごとに短縮名になりissueが分裂するため固定文字列を使う
    fingerprint: isObsBackendIpcLost
      ? ['IpcRequestError', 'ObsBackendIpcLost']
      : ['IpcRequestError', serviceName, method],
    level: isObsBackendIpcLost ? 'warning' : 'error',
  });

  return err;
}
