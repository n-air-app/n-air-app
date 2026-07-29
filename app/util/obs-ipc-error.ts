import { IpcRequestError } from './ipc-request-error';

// obs-studio-node が OBS バックエンドプロセス(obs64.exe)と通信する独自ネイティブ IPC が
// 切断された際のエラー文言（Electron の IPC とは無関係。詳細: n-air-app#1380）。
//   - Failed to make IPC call, verify IPC status. : 書き込み側 (ipc::client_win)
//   - Lost IPC Connection                        : 読み出し側 (deserialize 失敗)
// いずれも obs64.exe 側のクラッシュに起因し、アプリ側に再接続手段は存在しない。
const OBS_BACKEND_IPC_LOST_PATTERNS = [
  /Failed to make IPC call, verify IPC status\./,
  /Lost IPC Connection/,
];

export function isObsBackendIpcLostMessage(message: string | undefined | null): boolean {
  if (!message) return false;
  return OBS_BACKEND_IPC_LOST_PATTERNS.some((re) => re.test(message));
}

/**
 * 生の Error（メインウィンドウでのネイティブ例外）、IpcRequestError（RPC 越し。
 * 元のネイティブ文言は rpcError.message に入る）、string のいずれでも
 * OBS バックエンドIPC切断エラーかどうかを判定する。
 */
export function isObsBackendIpcLost(err: unknown): boolean {
  if (err == null) return false;
  if (typeof err === 'string') return isObsBackendIpcLostMessage(err);
  if (err instanceof IpcRequestError) {
    return (
      isObsBackendIpcLostMessage(err.rpcError?.message) ||
      isObsBackendIpcLostMessage(err.message)
    );
  }
  if (err instanceof Error) return isObsBackendIpcLostMessage(err.message);
  const message = (err as { message?: unknown }).message;
  return typeof message === 'string' && isObsBackendIpcLostMessage(message);
}
