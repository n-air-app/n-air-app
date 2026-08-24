/**
 * Electron のネットワークスタックを使ってリクエストし、IPC で転送可能な値へ変換する。
 *
 * @param {Pick<import('electron').Net, 'fetch'>} net
 * @param {string} url
 * @param {RequestInit} options
 * @returns {Promise<import('../app/util/fetchViaMainProcess.ts').MainProcessFetchResponse>}
 */
function extractErrorCode(error) {
  return error.code
    ?? error.cause?.code
    ?? error.message?.match(/net::(ERR_[A-Z_]+)/)?.[1]
    ?? '';
}

function isRetryableConnectionReset(error, options) {
  const method = (options.method ?? 'GET').toUpperCase();
  return (method === 'GET' || method === 'HEAD')
    && (extractErrorCode(error) === 'ERR_CONNECTION_RESET'
      || extractErrorCode(error) === 'ECONNRESET');
}

async function fetchOnce(net, url, options) {
  const response = await net.fetch(url, options);
  const text = await response.text();
  return {
    ok: response.ok,
    // iterator のままでは Electron IPC の構造化クローンで中身が失われるため配列化する
    headers: [...response.headers.entries()],
    status: response.status,
    text,
  };
}

async function fetchViaElectronNet(net, url, options, timeoutMs = 30_000, fallbackFetch = globalThis.fetch) {
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => {
    timeoutController.abort(Object.assign(new Error(`Request timed out after ${timeoutMs}ms`), {
      code: 'ETIMEDOUT',
    }));
  }, timeoutMs);
  const signal = options.signal
    ? AbortSignal.any([options.signal, timeoutController.signal])
    : timeoutController.signal;
  const requestOptions = { ...options, signal };
  try {
    let error;
    try {
      return await fetchOnce(net, url, requestOptions);
    } catch (e) {
      error = e;
    }

    let electronNetErrorCode = '';
    // 一部環境では Chromium ネットワークスタックの net.fetch だけが恒常的に接続リセットされる。
    // 冪等なリクエストに限り、以前使用していた Node.js の fetch へフォールバックする。
    if (isRetryableConnectionReset(error, options)) {
      electronNetErrorCode = extractErrorCode(error);
      try {
        return await fetchOnce({ fetch: fallbackFetch }, url, requestOptions);
      } catch (e) {
        error = e;
      }
    }

    // cause チェーンとURLを文字列化してrendererに伝搬する
    // (Electron の IPC シリアライズでは cause が失われるため)
    // [MAIN_FETCH_FAIL code=...] 接頭辞は renderer 側 wrapFetchError が機械可読に経路を判別するために使用する
    const causeCode = extractErrorCode(error);
    const cause = error.cause
      ? `${error.cause.name}: ${error.cause.message} (code: ${error.cause.code})`
      : undefined;
    const fallbackContext = electronNetErrorCode
      ? ` [ELECTRON_NET_FAIL code=${electronNetErrorCode}]`
      : '';
    throw new Error(
      `[MAIN_FETCH_FAIL code=${causeCode}]${fallbackContext} ${error.message} [url: ${url}, cause: ${cause ?? 'no cause'}]`,
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

module.exports = { fetchViaElectronNet };
