import * as fetchMock from 'fetch-mock';
import { NicoliveClient, parseMaxQuality, WrappedResult } from './NicoliveClient';
import { Communities, Community } from './ResponseTypes';

jest.mock('services/i18n', () => ({
  $t: (x: any) => x,
}));
jest.mock('util/menus/Menu', () => ({}));

afterEach(() => {
  fetchMock.reset();
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
    ['invalid', fallback.bitrate, fallback.height, fallback.fps],
  ])(`%s => %d kbps, %d x %d`, (maxQuality, bitrate, height, fps) => {
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
const communityID = 'co1';
const userID = 2;

const dummyURL = 'https://example.com';

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
  expect(fetchMock.done()).toBe(true);
});

test('wrapResultは結果が200でないときレスポンス全体を返す', async () => {
  fetchMock.get(dummyURL, { body: dummyErrorBody, status: 404 });
  const res = await fetch(dummyURL);

  await expect(NicoliveClient.wrapResult(res)).resolves.toEqual({
    ok: false,
    value: dummyErrorBody,
  });
  expect(fetchMock.done()).toBe(true);
});

test('wrapResultはbodyがJSONでなければSyntaxErrorをwrapして返す', async () => {
  fetchMock.get(dummyURL, 'invalid json');
  const res = await fetch(dummyURL);

  await expect(NicoliveClient.wrapResult(res)).resolves.toMatchInlineSnapshot(`
Object {
  "ok": false,
  "value": [SyntaxError: Unexpected token i in JSON at position 0],
}
`);
  expect(fetchMock.done()).toBe(true);
});

interface Suite {
  name: string;
  method: string;
  base: string;
  path: string;
  args?: any[];
}
const suites: Suite[] = [
  {
    name: 'fetchProgramSchedules',
    base: NicoliveClient.live2BaseURL,
    method: 'get',
    path: '/unama/tool/v1/program_schedules',
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
    name: 'fetchStatistics',
    method: 'get',
    base: NicoliveClient.live2BaseURL,
    path: `/watch/${programID}/statistics`,
    args: [programID],
  },
  {
    name: 'fetchNicoadStatistics',
    method: 'get',
    base: NicoliveClient.nicoadBaseURL,
    path: `/v1/live/statusarea/${programID}`,
    args: [programID],
  },
  {
    name: 'fetchModerators',
    method: 'get',
    base: NicoliveClient.live2BaseURL,
    path: `/unama/api/v2/broadcasters/moderators`,
    args: [],
  },
  {
    name: 'addModerator',
    method: 'post',
    base: NicoliveClient.live2BaseURL,
    path: `/unama/api/v2/broadcasters/moderators`,
    args: [userID],
  },
  {
    name: 'removeModerator',
    method: 'delete',
    base: NicoliveClient.live2BaseURL,
    path: `/unama/api/v2/broadcasters/moderators?userId=${userID}`,
    args: [userID],
  },
];

suites.forEach((suite: Suite) => {
  test(`dataを取り出して返す - ${suite.name}`, async () => {
    // niconicoSession を与えないと、実行時の main process の cookieから取ろうとして失敗するので差し替える
    const client = new NicoliveClient({
      niconicoSession: 'dummy',
      enableModeratorAPICall: true, // DEBUG
    });

    fetchMock[suite.method.toLowerCase()](suite.base + suite.path, dummyBody);
    const result = await client[suite.name](...(suite.args || []));

    expect(result).toEqual({ ok: true, value: dummyBody.data });
    expect(fetchMock.done()).toBe(true);
  });
});

const dummyCommunities: Communities = {
  meta: {
    status: 200,
  },
  data: {
    communities: {
      total: 1,
      communities: [
        {
          global_id: communityID,
          id: communityID.replace(/^co/, ''),
          name: 'name',
          description: 'description',
          public: 'open',
          icon: {
            id: 1,
            url: {
              size_64x64: 'url',
              size_128x128: 'url',
            },
          },
        },
      ],
    },
  },
};

test('fetchCommunityはコミュをひとつだけ返す', async () => {
  const client = new NicoliveClient();

  fetchMock.get(
    `${NicoliveClient.communityBaseURL}/api/v2/communities.json?ids=${communityID.replace(
      /^co/,
      '',
    )}`,
    dummyCommunities,
  );
  const result = (await client.fetchCommunity(communityID)) as WrappedResult<Community>;

  expect(result).toEqual({ ok: true, value: dummyCommunities.data.communities.communities[0] });
  expect(fetchMock.done()).toBe(true);
});

test('fetchCommunityはbodyがJSONでなければSyntaxErrorをwrapして返す', async () => {
  const client = new NicoliveClient();

  fetchMock.get(
    `${NicoliveClient.communityBaseURL}/api/v2/communities.json?ids=${communityID.replace(
      /^co/,
      '',
    )}`,
    'invalid json',
  );
  const result = client.fetchCommunity(communityID);

  await expect(result).resolves.toMatchInlineSnapshot(`
Object {
  "ok": false,
  "value": [SyntaxError: Unexpected token i in JSON at position 0],
}
`);
  expect(fetchMock.done()).toBe(true);
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
        cb({ preventDefault() {} }, url);
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
    browserWindow: null,
    openExternal,
  };
  jest.doMock('electron', () => ({
    remote: {
      BrowserWindow,
      shell: {
        openExternal,
      },
    },
    ipcRenderer: {
      send() {},
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
    mock.browserWindow.loadURL(`https://live.nicovideo.jp/watch/${programID}`);
    await result;
    expect(mock.browserWindow.removeMenu).toHaveBeenCalled();
  });

  test('createProgramで番組ページへ遷移すると番組を作成したことになる', async () => {
    const mock = setupMock();

    const { NicoliveClient } = require('./NicoliveClient');
    const client = new NicoliveClient();

    // don't await
    const result = expect(client.createProgram()).resolves.toBe('CREATED');
    mock.browserWindow.loadURL(`https://live.nicovideo.jp/watch/${programID}`);

    await result;
    expect(mock.browserWindow.close).toHaveBeenCalled();
  });

  test('createProgramでマイページに遷移すると番組を予約したことになる', async () => {
    const mock = setupMock();

    const { NicoliveClient } = require('./NicoliveClient');
    const client = new NicoliveClient();

    // don't await
    const result = expect(client.createProgram()).resolves.toBe('RESERVED');
    mock.browserWindow.loadURL('https://live.nicovideo.jp/my');

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
    mock.browserWindow.loadURL(`https://live.nicovideo.jp/watch/${programID}`);
    await result;
    expect(mock.browserWindow.removeMenu).toHaveBeenCalled();
  });

  test('editProgramで番組ページへ遷移すると番組を作成したことになる', async () => {
    const mock = setupMock();

    const { NicoliveClient } = require('./NicoliveClient');
    const client = new NicoliveClient();

    // don't await
    const result = expect(client.editProgram(programID)).resolves.toBe('EDITED');
    mock.browserWindow.loadURL(`https://live.nicovideo.jp/watch/${programID}`);

    await result;
    expect(mock.browserWindow.close).toHaveBeenCalled();
  });

  test('editProgramでマイページに遷移すると番組を予約したことになる', async () => {
    const mock = setupMock();

    const { NicoliveClient } = require('./NicoliveClient');
    const client = new NicoliveClient();

    // don't await
    const result = expect(client.editProgram(programID)).resolves.toBe('EDITED');
    mock.browserWindow.loadURL('https://live.nicovideo.jp/my');

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

// TODO add test for konomiTags, userFollow APIs
