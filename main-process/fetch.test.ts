import { fetchViaElectronNet } from './fetch';

describe('fetchViaElectronNet', () => {
  test('net.fetch にリクエストをそのまま渡し、IPC で転送可能なレスポンスを返す', async () => {
    const options: RequestInit = {
      method: 'POST',
      headers: { Cookie: 'user_session=abc', Origin: 'https://www.nicovideo.jp' },
      body: JSON.stringify({ test: true }),
    };
    const response = {
      ok: true,
      headers: new Headers([
        ['content-type', 'application/json'],
        ['set-cookie', 'user_session=updated'],
      ]),
      status: 200,
      text: jest.fn().mockResolvedValue('{"result":"ok"}'),
    };
    const net = { fetch: jest.fn().mockResolvedValue(response) };

    await expect(fetchViaElectronNet(net, 'https://example.com/ingest', options)).resolves.toEqual({
      ok: true,
      headers: [
        ['content-type', 'application/json'],
        ['set-cookie', 'user_session=updated'],
      ],
      status: 200,
      text: '{"result":"ok"}',
    });
    expect(net.fetch).toHaveBeenCalledWith('https://example.com/ingest', {
      ...options,
      signal: expect.any(AbortSignal),
    });
  });

  test('fetch 失敗時に cause の診断情報とURLを MAIN_FETCH_FAIL として返す', async () => {
    const cause = Object.assign(new Error('self signed certificate in certificate chain'), {
      code: 'SELF_SIGNED_CERT_IN_CHAIN',
    });
    const error = new Error('fetch failed', { cause });
    const net = { fetch: jest.fn().mockRejectedValue(error) };

    await expect(fetchViaElectronNet(net, 'https://example.com/ingest', {})).rejects.toThrow(
      '[MAIN_FETCH_FAIL code=SELF_SIGNED_CERT_IN_CHAIN] fetch failed [url: https://example.com/ingest, cause: Error: self signed certificate in certificate chain (code: SELF_SIGNED_CERT_IN_CHAIN)]',
    );
  });

  test('応答がない場合はタイムアウトして ETIMEDOUT を返す', async () => {
    const net = {
      fetch: jest.fn((_url: string, options: RequestInit) => new Promise<Response>((_resolve, reject) => {
        options.signal?.addEventListener('abort', () => reject(options.signal?.reason));
      })),
    };

    await expect(fetchViaElectronNet(net, 'https://example.com/onairs', {}, 10)).rejects.toThrow(
      '[MAIN_FETCH_FAIL code=ETIMEDOUT] Request timed out after 10ms',
    );
  });

  test('GETがERR_CONNECTION_RESETになった場合は1回だけ再試行する', async () => {
    const response = {
      ok: true,
      headers: new Headers(),
      status: 200,
      text: jest.fn().mockResolvedValue('{"programId":"lv1"}'),
    };
    const net = {
      fetch: jest.fn()
        .mockRejectedValueOnce(new Error('net::ERR_CONNECTION_RESET'))
        .mockResolvedValueOnce(response),
    };

    await expect(fetchViaElectronNet(net, 'https://example.com/onairs', {})).resolves.toEqual({
      ok: true,
      headers: [],
      status: 200,
      text: '{"programId":"lv1"}',
    });
    expect(net.fetch).toHaveBeenCalledTimes(2);
  });

  test('POSTがERR_CONNECTION_RESETになっても再試行しない', async () => {
    const net = { fetch: jest.fn().mockRejectedValue(new Error('net::ERR_CONNECTION_RESET')) };

    await expect(fetchViaElectronNet(net, 'https://example.com/program', { method: 'POST' })).rejects.toThrow(
      '[MAIN_FETCH_FAIL code=ERR_CONNECTION_RESET] net::ERR_CONNECTION_RESET',
    );
    expect(net.fetch).toHaveBeenCalledTimes(1);
  });
});
