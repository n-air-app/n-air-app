/* eslint-disable import/first */
// NicoliveClient must be imported AFTER the fetchViaMainProcess mock is set up,
// so that when Jest loads NicoliveClient (which imports fetchViaMainProcess),
// the mock factory can reference the already-initialized fetchViaMainProcess variable.
import fetchMock from '@fetch-mock/jest';
import type { MainProcessFetchResponse } from 'util/fetchViaMainProcess';

const sentryMessage = jest.fn();
const sentryError = jest.fn();

jest.mock('services/i18n', () => ({
  $t: (x: any) => x,
}));
jest.mock('util/menus/Menu', () => ({}));
jest.mock('@electron/remote', () => ({
  BrowserWindow: jest.fn(),
  session: {
    defaultSession: {
      webRequest: {
        onBeforeSendHeaders: jest.fn(),
      },
    },
  },
}));
const fetchViaMainProcess = jest
  .fn<Promise<MainProcessFetchResponse>, [string, RequestInit]>()
  .mockName('fetchViaMainProcess');
jest.mock('util/fetchViaMainProcess', () => ({
  fetchViaMainProcess,
}));
jest.mock('util/sentry-report', () => ({
  SentryReport: { error: sentryError, message: sentryMessage },
}));

import { NicoliveClient, parseMaxQuality } from './NicoliveClient';

beforeEach(() => {
  Object.defineProperty(process, 'type', {
    configurable: true,
    value: 'renderer',
  });
  fetchMock.mockGlobal();
});

afterEach(() => {
  fetchMock.mockRestore({ includeSticky: true });
  fetchViaMainProcess.mockReset();
  sentryError.mockReset();
  sentryMessage.mockReset();
});

describe('parseMaxQuality', () => {
  const fallback = { bitrate: 192, height: 288, fps: 30 };
  test.each([
    ['6Mbps720p', 6000, 720, 30],
    ['2Mbps450p', 2000, 450, 30],
    ['1Mbps450p', 1000, 450, 30],
    ['384kbps288p', 384, 288, 30],
    ['192kbps288p', 192, 288, 30],
    ['8Mbps1080p60fps', 8000, 1080, 60],
    ['1.5Mbps480p', 1500, 480, 30],
    ['1500kbps480p', 1500, 480, 30],
    ['1.5Mbps480p29.97fps', 1500, 480, 29.97],
    ['invalid', fallback.bitrate, fallback.height, fallback.fps],
  ])('%s => %d kbps, %d x %d', (maxQuality, bitrate, height, fps) => {
    expect(parseMaxQuality(maxQuality, fallback)).toEqual({
      bitrate,
      height,
      fps,
    });
  });
});

test('constructor', () => {
  const client = new NicoliveClient();
  expect(client).toBeInstanceOf(NicoliveClient);
});

// 実際には叩かないのでなんでもよい
const programID = 'lv1';
const userID = 2;

const dummyURL = 'https://example.com';

const nicoliveWeb = 'https://live.nicovideo.jp';

const dummyBody = {
  meta: {
    status: 200,
    errorCode: 'OK',
  },
  data: 'dummy body',
};

const dummyErrorBody = {
  meta: {
    status: 404,
    errorCode: 'NOT_FOUND',
  },
};

test('wrapResultはレスポンスのdataを取り出す', async () => {
  fetchMock.get(dummyURL, dummyBody);
  const res = await fetch(dummyURL);

  await expect(NicoliveClient.wrapResult(res)).resolves.toEqual({
    ok: true,
    value: dummyBody.data,
  });
  expect(fetchMock.callHistory.done()).toBe(true);
});

test('wrapResultは結果が200でないときレスポンス全体を返す', async () => {
  fetchMock.get(dummyURL, { body: JSON.stringify(dummyErrorBody), status: 404 });
  const res = await fetch(dummyURL);

  // diag フィールドが追加されるため toMatchObject で検証
  await expect(NicoliveClient.wrapResult(res)).resolves.toMatchObject({
    ok: false,
    value: dummyErrorBody,
    diag: { route: 'renderer', httpStatus: 404, failureKind: 'http_error' },
  });
  expect(fetchMock.callHistory.done()).toBe(true);
});

test('wrapResultはbodyがJSONでなければSyntaxErrorをwrapして返す', async () => {
  fetchMock.get(dummyURL, 'invalid json');
  const res = await fetch(dummyURL);

  // diag フィールドが追加されるため toMatchObject で検証
  const result = await NicoliveClient.wrapResult(res);
  expect(result.ok).toBe(false);
  expect((result as any).value).toBeInstanceOf(SyntaxError);
  expect((result as any).diag).toMatchObject({ route: 'renderer', failureKind: 'json_parse' });
  expect(fetchMock.callHistory.done()).toBe(true);
});

// upstream(プロキシ等)障害時、レスポンスがプレーンテキスト
// (例: "upstream connect error or disconnect/reset before headers") で返ってくることがある。
// .json() を直接呼ぶと catch されない SyntaxError が伝播しクラッシュ扱いになるため、
// 明示的な Error に変換されることを確認する。
const upstreamErrorBody = 'upstream connect error or disconnect/reset before headers';

describe('非JSONレスポンスの安全な取り扱い', () => {
  test('fetchOnairUserProgramはbodyがJSONでなければSyntaxErrorではなくErrorを投げる', async () => {
    const client = new NicoliveClient({ niconicoSession: 'dummy' });
    fetchViaMainProcess.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: [],
      text: upstreamErrorBody,
    });

    let error: unknown;
    await client.fetchOnairUserProgram().catch((e) => { error = e; });
    expect(error).not.toBeInstanceOf(SyntaxError);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(/fetchOnairUserProgram/);
    expect((error as Error).cause).toBeInstanceOf(SyntaxError);
  });

  test('fetchKonomiTagsはbodyがJSONでなければSyntaxErrorではなくErrorを投げる', async () => {
    const client = new NicoliveClient({ niconicoSession: 'dummy' });
    fetchViaMainProcess.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: [],
      text: upstreamErrorBody,
    });

    let error: unknown;
    await client.fetchKonomiTags(String(userID)).catch((e) => { error = e; });
    expect(error).not.toBeInstanceOf(SyntaxError);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(/fetchKonomiTags/);
    expect((error as Error).cause).toBeInstanceOf(SyntaxError);
  });

  test('fetchUserFollowはbodyがJSONでなければSyntaxErrorではなくErrorを投げる', async () => {
    const client = new NicoliveClient({ niconicoSession: 'dummy' });
    fetchViaMainProcess.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: [],
      text: upstreamErrorBody,
    });

    let error: unknown;
    await client.fetchUserFollow(String(userID)).catch((e) => { error = e; });
    expect(error).not.toBeInstanceOf(SyntaxError);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(/fetchUserFollow/);
    expect((error as Error).cause).toBeInstanceOf(SyntaxError);
  });

  test('unFollowUserは失敗レスポンスがJSONでなくてもSyntaxErrorを投げず本来のエラーメッセージを返す', async () => {
    const client = new NicoliveClient({ niconicoSession: 'dummy' });
    fetchViaMainProcess.mockResolvedValueOnce({
      ok: false,
      status: 502,
      headers: [],
      text: upstreamErrorBody,
    });

    let error: unknown;
    await client.unFollowUser(String(userID)).catch((e) => { error = e; });
    expect(error).not.toBeInstanceOf(SyntaxError);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(/unFollowUser failed: 502/);
  });
});

interface Suite {
  name: keyof NicoliveClient;
  method: 'get' | 'post' | 'put' | 'delete';
  base: string;
  path: string;
  args: any[];
}
const suites: Suite[] = [
  {
    name: 'fetchProgramSchedules',
    base: NicoliveClient.live2BaseURL,
    method: 'get',
    path: '/unama/tool/v1/program_schedules',
    args: [],
  },
  {
    name: 'fetchProgram',
    method: 'get',
    base: NicoliveClient.live2BaseURL,
    path: `/watch/${programID}/programinfo`,
    args: [programID],
  },
  {
    name: 'startProgram',
    method: 'put',
    base: NicoliveClient.live2BaseURL,
    path: `/watch/${programID}/segment`,
    args: [programID],
  },
  {
    name: 'endProgram',
    method: 'put',
    base: NicoliveClient.live2BaseURL,
    path: `/watch/${programID}/segment`,
    args: [programID],
  },
  {
    name: 'extendProgram',
    method: 'post',
    base: NicoliveClient.live2BaseURL,
    path: `/watch/${programID}/extension`,
    args: [programID],
  },
  {
    name: 'sendOperatorComment',
    method: 'put',
    base: NicoliveClient.live2BaseURL,
    path: `/watch/${programID}/operator_comment`,
    args: [programID, { text: 'comment text', isPermanent: true }],
  },
  {
    name: 'fetchModerators',
    method: 'get',
    base: NicoliveClient.live2BaseURL,
    path: '/unama/api/v2/broadcasters/moderators',
    args: [],
  },
  {
    name: 'addModerator',
    method: 'post',
    base: NicoliveClient.live2BaseURL,
    path: '/unama/api/v2/broadcasters/moderators',
    args: [userID],
  },
  {
    name: 'removeModerator',
    method: 'delete',
    base: NicoliveClient.live2BaseURL,
    path: `/unama/api/v2/broadcasters/moderators?userId=${userID}`,
    args: [userID],
  },
  {
    name: 'fetchSupporters',
    method: 'get',
    base: NicoliveClient.live2ApiBaseURL,
    path: '/api/v1/broadcaster/supporters?limit=1000&offset=0',
    args: [],
  },
];

suites.forEach((suite: Suite) => {
  test(`dataを取り出して返す - ${suite.name}`, async () => {
    // niconicoSession を与えないと、実行時の main process の cookieから取ろうとして失敗するので差し替える
    const client = new NicoliveClient({
      niconicoSession: 'dummy',
    });

    // Cookie 明示付与のため requestAPI は renderer では main 経由になる
    fetchViaMainProcess.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: [],
      text: JSON.stringify(dummyBody),
    });
    // @ts-expect-error 引数の型
    const result = await client[suite.name](...suite.args);

    expect(result).toEqual({ ok: true, value: dummyBody.data });
    expect(fetchViaMainProcess).toHaveBeenCalled();
  });
});

function setupMock() {
  class BrowserWindow {
    url: string = '';
    webContentsCallbacks: any[] = [];
    callbacks: any[] = [];

    webContents = {
      on: (_event: string, callback: (ev: any, url: string) => any) => {
        this.webContentsCallbacks.push(callback);
      },
    };
    on(event: string, callback: (evt: any) => any) {
      this.callbacks.push(callback);
    }
    loadURL(url: string) {
      this.url = url;
      for (const cb of this.webContentsCallbacks) {
        cb({ preventDefault() { } }, url);
      }
    }
    close = jest.fn().mockImplementation(() => {
      for (const cb of this.callbacks) {
        // 雑
        cb(null);
      }
    });
    removeMenu = jest.fn();
    options: any;
    constructor(options: any) {
      this.options = options;
      wrapper.browserWindow = this;
    }
  }

  const openExternal = jest.fn();
  let wrapper: {
    browserWindow: BrowserWindow;
    openExternal: jest.Mock;
  } = {
    browserWindow: null as unknown as BrowserWindow,
    openExternal,
  };
  jest.doMock('@electron/remote', () => ({
    BrowserWindow,
    shell: {
      openExternal,
    },
  }));
  jest.doMock('electron', () => ({
    ipcRenderer: {
      send() { },
    },
  }));

  return wrapper;
}

describe('webviews', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('createProgramで removeMenuが呼ばれる', async () => {
    const mock = setupMock();

    const { NicoliveClient } = require('./NicoliveClient');
    const client = new NicoliveClient();

    // don't await
    const result = expect(client.createProgram()).resolves.toBe('CREATED');
    mock.browserWindow.loadURL(`${nicoliveWeb}/watch/${programID}`);
    await result;
    expect(mock.browserWindow.removeMenu).toHaveBeenCalled();
  });

  test('createProgramで番組ページへ遷移すると番組を作成したことになる', async () => {
    const mock = setupMock();

    const { NicoliveClient } = require('./NicoliveClient');
    const client = new NicoliveClient();

    // don't await
    const result = expect(client.createProgram()).resolves.toBe('CREATED');
    mock.browserWindow.loadURL(`${nicoliveWeb}/watch/${programID}`);

    await result;
    expect(mock.browserWindow.close).toHaveBeenCalled();
  });

  test('createProgramでマイページに遷移すると番組を予約したことになる', async () => {
    const mock = setupMock();

    const { NicoliveClient } = require('./NicoliveClient');
    const client = new NicoliveClient();

    // don't await
    const result = expect(client.createProgram()).resolves.toBe('RESERVED');
    mock.browserWindow.loadURL(`${nicoliveWeb}/my`);

    await result;
    expect(mock.browserWindow.close).toHaveBeenCalled();
  });

  test('createProgramでニコ生外に出ると既定のブラウザで開いてwebviewは閉じる', async () => {
    const openExternal = jest.fn();
    const mock = setupMock();

    const { NicoliveClient } = require('./NicoliveClient');
    const client = new NicoliveClient();

    // don't await
    const result = expect(client.createProgram()).resolves.toBe('OTHER');
    mock.browserWindow.loadURL('https://example.com');

    await result;
    expect(mock.browserWindow.close).toHaveBeenCalled();
    expect(mock.openExternal).toHaveBeenCalledWith('https://example.com');
  });

  test('createProgramで何もせず画面を閉じても結果が返る', async () => {
    const mock = setupMock();

    const { NicoliveClient } = require('./NicoliveClient');
    const client = new NicoliveClient();

    // don't await
    const result = expect(client.createProgram()).resolves.toBe('OTHER');
    mock.browserWindow.close();

    await result;
    expect(mock.browserWindow.close).toHaveBeenCalled();
  });

  test('editProgramでremoveMenuが呼ばれる', async () => {
    const mock = setupMock();

    const { NicoliveClient } = require('./NicoliveClient');
    const client = new NicoliveClient();

    const result = expect(client.editProgram(programID)).resolves.toBe('EDITED');
    mock.browserWindow.loadURL(`${nicoliveWeb}/watch/${programID}`);
    await result;
    expect(mock.browserWindow.removeMenu).toHaveBeenCalled();
  });

  test('editProgramで番組ページへ遷移すると番組を作成したことになる', async () => {
    const mock = setupMock();

    const { NicoliveClient } = require('./NicoliveClient');
    const client = new NicoliveClient();

    // don't await
    const result = expect(client.editProgram(programID)).resolves.toBe('EDITED');
    mock.browserWindow.loadURL(`${nicoliveWeb}/watch/${programID}`);

    await result;
    expect(mock.browserWindow.close).toHaveBeenCalled();
  });

  test('editProgramでマイページに遷移すると番組を予約したことになる', async () => {
    const mock = setupMock();

    const { NicoliveClient } = require('./NicoliveClient');
    const client = new NicoliveClient();

    // don't await
    const result = expect(client.editProgram(programID)).resolves.toBe('EDITED');
    mock.browserWindow.loadURL(`${nicoliveWeb}/my`);

    await result;
    expect(mock.browserWindow.close).toHaveBeenCalled();
  });

  test('editProgramでニコ生外に出ると既定のブラウザで開いてwebviewは閉じる', async () => {
    const mock = setupMock();

    const { NicoliveClient } = require('./NicoliveClient');
    const client = new NicoliveClient();

    // don't await
    const result = expect(client.editProgram(programID)).resolves.toBe('OTHER');
    mock.browserWindow.loadURL('https://example.com');

    await result;
    expect(mock.browserWindow.close).toHaveBeenCalled();
    expect(mock.openExternal).toHaveBeenCalledWith('https://example.com');
  });

  test('editProgramで何もせず画面を閉じても結果が返る', async () => {
    const mock = setupMock();

    const { NicoliveClient } = require('./NicoliveClient');
    const client = new NicoliveClient();

    // don't await
    const result = expect(client.editProgram(programID)).resolves.toBe('OTHER');
    mock.browserWindow.close();

    await result;
    expect(mock.browserWindow.close).toHaveBeenCalled();
  });
});

describe('NicoliveClient.wrapResult', () => {
  const headers: [string, string][] = [['Date', 'Tue, 01 Jan 2019 00:00:00 GMT']];
  const serverDateMs = new Date('2019-01-01T00:00:00Z').valueOf();

  test.each<[string, boolean, string | null, MainProcessFetchResponse | Response]>(
    (
      [
        [200, '{"data": "ok"}', 'ok'],
        [204, null, null],
        [404, '"not found"', 'not found'],
      ] as [number, string, string | null][]
    ).flatMap(([status, text, expect]) =>
      [false, true].map<[string, boolean, string | null, MainProcessFetchResponse | Response]>(
        (viaMainProcess) => {
          const ok = status < 400;
          return [
            `status:${status} viaMainProcess:${viaMainProcess}`,
            ok,
            expect,
            viaMainProcess
              ? {
                ok,
                headers,
                status,
                text,
              }
              : new Response(text, { status, headers }),
          ];
        },
      ),
    ),
  )('%p ok:%p expect:%p', async (_label, ok, value, response) => {
    const res = await NicoliveClient.wrapResult<string>(response);
    console.log(res);
    // diag フィールドが失敗時に追加されるため toMatchObject で検証
    expect(res).toMatchObject({
      ok,
      ...(ok ? { serverDateMs } : {}),
      value,
    });
  });
});

type DeleteCommentTestCase = [
  boolean,
  string | Error | null,
  () => Promise<MainProcessFetchResponse>,
];

describe('NicoliveClient.deleteComment', () => {
  setupMock();
  const error = new Error('error');

  test.each<DeleteCommentTestCase>([
    [
      true,
      null,
      () =>
        Promise.resolve<MainProcessFetchResponse>({
          ok: true,
          headers: [],
          status: 204,
          text: '',
        }),
    ],
    [
      false,
      'not found',
      () =>
        Promise.resolve<MainProcessFetchResponse>({
          ok: false,
          headers: [],
          status: 404,
          text: '"not found"',
        }),
    ],
    [false, error, () => Promise.reject(error)],
  ])('ok:%p expect value:%v', async (ok, value, createResponse) => {
    fetchViaMainProcess.mockImplementationOnce(createResponse);

    const client = new NicoliveClient({ niconicoSession: 'dummy' });
    {
      const res = client.deleteComment('lv1', '1');
      // diag フィールドが失敗時に追加されるため toMatchObject で検証
      await expect(res).resolves.toMatchObject({ ok, value });
      expect(fetchViaMainProcess).toHaveBeenCalledWith(expect.anything(), expect.anything());
    }
  });

  test('Origin ヘッダーはパスを含まない scheme://host のみで main 経由リクエストに載る', async () => {
    fetchViaMainProcess.mockResolvedValueOnce(
      Promise.resolve<MainProcessFetchResponse>({ ok: true, headers: [], status: 204, text: '' }),
    );

    const client = new NicoliveClient({ niconicoSession: 'dummy' });
    await client.deleteComment('lv1', '1');

    expect(fetchViaMainProcess).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        headers: expect.objectContaining({ Origin: 'https://live.nicovideo.jp' }),
      }),
    );
  });

  test('Electron net失敗後にNode.jsフォールバックが成功したことをSentryへ一度だけ送る', async () => {
    fetchViaMainProcess.mockResolvedValue({
      ok: true,
      headers: [],
      status: 204,
      text: '',
      transport: 'node-fetch-fallback',
      electronNetErrorCode: 'ERR_CONNECTION_RESET',
    });

    const client = new NicoliveClient({ niconicoSession: 'dummy' });
    await client.fetchIngestInfo('lv1');
    await client.fetchIngestInfo('lv1');

    expect(sentryMessage).toHaveBeenCalledTimes(1);
    expect(sentryMessage).toHaveBeenCalledWith(
      'NicoliveClient',
      'requestWithSession',
      'Electron network request failed; Node.js fallback succeeded',
      expect.objectContaining({
        level: 'warning',
        tags: {
          transport: 'electron-net',
          errorCode: 'ERR_CONNECTION_RESET',
          httpMethod: 'PUT',
          fallbackSuccess: 'true',
        },
        context: {
          request: { endpoint: 'https://live2.nicovideo.jp/unama/api/v4/ingest_info' },
        },
      }),
    );
  });
});

describe('NicoliveClient.wrapFetchError', () => {
  test('renderer 直送の失敗は route=renderer / errorCode なし', async () => {
    const res = await NicoliveClient.wrapFetchError(new Error('fetch failed'), 'renderer');
    expect(res.ok).toBe(false);
    expect(res.diag).toMatchObject({ route: 'renderer', failureKind: 'network_error' });
    expect(res.diag?.errorCode).toBeUndefined();
  });

  test('main 経由の証明書エラーは MAIN_FETCH_FAIL マーカーから errorCode を取り出し route=main になる', async () => {
    // Electron IPC は main 側 Error に `Error invoking remote method 'fetch': Error: ` の接頭辞を付けるため、
    // 行頭ではなく message 途中にマーカーが現れる。それでも code を取り出せることを確認する
    const message =
      "Error invoking remote method 'fetch': Error: [MAIN_FETCH_FAIL code=SELF_SIGNED_CERT_IN_CHAIN]"
      + ' fetch failed [url: https://live2.nicovideo.jp/unama/api/v4/ingest_info?nicoliveProgramId=lv1, cause: ...]';
    const res = await NicoliveClient.wrapFetchError(new Error(message), 'renderer');
    expect(res.ok).toBe(false);
    expect(res.diag).toMatchObject({
      route: 'main',
      failureKind: 'network_error',
      errorCode: 'SELF_SIGNED_CERT_IN_CHAIN',
    });
  });

  test('main 経由でも code が空文字なら errorCode は undefined', async () => {
    const res = await NicoliveClient.wrapFetchError(
      new Error('[MAIN_FETCH_FAIL code=] fetch failed [url: https://x, cause: no cause]'),
      'renderer',
    );
    expect(res.diag).toMatchObject({ route: 'main', failureKind: 'network_error' });
    expect(res.diag?.errorCode).toBeUndefined();
  });
});

// TODO add test for konomiTags, userFollow APIs
