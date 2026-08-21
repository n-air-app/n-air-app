/**
 * Electron のネットワークスタックを使ってリクエストし、IPC で転送可能な値へ変換する。
 *
 * @param {Pick<import('electron').Net, 'fetch'>} net
 * @param {string} url
 * @param {RequestInit} options
 * @returns {Promise<import('../app/util/fetchViaMainProcess.ts').MainProcessFetchResponse>}
 */
const RETRY_DELAY_MS = 250;

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

async function fetchOnce(net, url, options, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort(Object.assign(new Error(`Request timed out after ${timeoutMs}ms`), {
      code: 'ETIMEDOUT',
    }));
  }, timeoutMs);

  try {
    const response = await net.fetch(url, { ...options, signal: controller.signal });
    const text = await response.text();
    return {
      ok: response.ok,
      // iterator のままでは Electron IPC の構造化クローンで中身が失われるため配列化する
      headers: [...response.headers.entries()],
      status: response.status,
      text,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchViaElectronNet(net, url, options, timeoutMs = 30_000) {
  let error;
  try {
    return await fetchOnce(net, url, options, timeoutMs);
  } catch (e) {
    error = e;
  }

  // net.fetch へ切り替えた一部環境で、配信開始直後のGETだけ接続がリセットされることがある。
  // 冪等なリクエストに限り1回だけ再試行し、一過性障害ならユーザー操作なしで復旧する。
  if (isRetryableConnectionReset(error, options)) {
    await new Promise((resolve) => {
      setTimeout(resolve, RETRY_DELAY_MS);
    });
    try {
      return await fetchOnce(net, url, options, timeoutMs);
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
  throw new Error(
    `[MAIN_FETCH_FAIL code=${causeCode}] ${error.message} [url: ${url}, cause: ${cause ?? 'no cause'}]`,
  );
}

module.exports = { fetchViaElectronNet };
