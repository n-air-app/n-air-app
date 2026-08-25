import { ipcRenderer } from 'electron';

/** main process の IPC 'fetch' の返り値
 */
export type MainProcessFetchResponse = {
  ok: boolean;
  headers: [string, string][];
  status: number;
  text: string;
  /** 実際にレスポンスを取得した通信経路。古いmain processとの互換性のため省略可能。 */
  transport?: 'electron-net' | 'node-fetch-fallback';
  /** Node.js fetchへのフォールバック前にElectron net.fetchで発生したエラーコード。 */
  electronNetErrorCode?: string;
};

export function fetchViaMainProcess(
  url: string,
  init: RequestInit,
): Promise<MainProcessFetchResponse> {
  return ipcRenderer.invoke('fetch', url, init);
}
