import * as Sentry from '@sentry/vue';

import { IpcRequestError } from './ipc-request-error';
import { SentryReport } from './sentry-report';

// メインウィンドウ自体が IPC 応答不能（クラッシュ/リロード中等）な状態を示す main プロセス側のエラー文言。
// OBS バックエンドの例外とは原因が異なるため別 issue として分離・降格する。
const MAIN_WINDOW_UNREACHABLE_RE = /Failed to make IPC call, verify IPC status\./;

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

  const isMainWindowUnreachable = MAIN_WINDOW_UNREACHABLE_RE.test(rpcError.message ?? '');

  const tags: Record<string, string> = {
    isHelper: String(isHelper),
    'rpc.code': String(rpcError.code),
    'ipc.mainErrorKind': isMainWindowUnreachable ? 'mainWindowUnreachable' : 'other',
  };
  if (isHelper && resourceId) tags.resourceId = resourceId;

  SentryReport.error(serviceName, method, err, {
    tags,
    extra: { mainError: rpcError.message ?? '(no message)' },
    // err.name は minify でチャンクごとに短縮名になりissueが分裂するため固定文字列を使う
    fingerprint: isMainWindowUnreachable
      ? ['IpcRequestError', 'MainWindowUnreachable']
      : ['IpcRequestError', serviceName, method],
    level: isMainWindowUnreachable ? 'warning' : 'error',
  });

  return err;
}
