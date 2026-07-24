import * as Sentry from '@sentry/vue';

import { IpcRequestError } from './ipc-request-error';
import { SentryReport } from './sentry-report';

// obs-studio-node が OBS バックエンドプロセスと通信する独自ネイティブ IPC が切断された際の
// main プロセス側エラー文言（Electron の IPC とは無関係。詳細: n-air-app#1380）。
// アプリ側に再接続機構がなく既知の未解決issueのため、原因不明の他エラーとは分離・降格する。
const OBS_BACKEND_IPC_LOST_RE = /Failed to make IPC call, verify IPC status\./;

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

  const isObsBackendIpcLost = OBS_BACKEND_IPC_LOST_RE.test(rpcError.message ?? '');

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
