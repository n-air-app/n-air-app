/**
 * Electron のネットワークスタックを使ってリクエストし、IPC で転送可能な値へ変換する。
 *
 * @param {Pick<import('electron').Net, 'fetch'>} net
 * @param {string} url
 * @param {RequestInit} options
 * @returns {Promise<import('../app/util/fetchViaMainProcess.ts').MainProcessFetchResponse>}
 */
async function fetchViaElectronNet(net, url, options) {
  try {
    const response = await net.fetch(url, options);
    const text = await response.text();
    return {
      ok: response.ok,
      // iterator のままでは Electron IPC の構造化クローンで中身が失われるため配列化する
      headers: [...response.headers.entries()],
      status: response.status,
      text,
    };
  } catch (e) {
    // cause チェーンとURLを文字列化してrendererに伝搬する
    // (Electron の IPC シリアライズでは cause が失われるため)
    // [MAIN_FETCH_FAIL code=...] 接頭辞は renderer 側 wrapFetchError が機械可読に経路を判別するために使用する
    const causeCode = e.cause?.code ?? '';
    const cause = e.cause
      ? `${e.cause.name}: ${e.cause.message} (code: ${e.cause.code})`
      : undefined;
    throw new Error(
      `[MAIN_FETCH_FAIL code=${causeCode}] ${e.message} [url: ${url}, cause: ${cause ?? 'no cause'}]`,
    );
  }
}

module.exports = { fetchViaElectronNet };
