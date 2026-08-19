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
    expect(net.fetch).toHaveBeenCalledWith('https://example.com/ingest', options);
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
});
