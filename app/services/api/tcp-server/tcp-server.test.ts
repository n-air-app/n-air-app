jest.mock('services/core/stateful-service', () => ({
  StatefulService: class {
    static initialState: any = {};
    static store: any = { watch: jest.fn() };
    static getState() {
      return {};
    }
  },
  mutation: () => (_target: any, _key: string, descriptor: any) => descriptor,
}));
jest.mock('services/core/injector', () => ({
  Inject: () => (_target: any, _key: string) => {},
}));
jest.mock('services/core', () => ({
  PersistentStatefulService: class {
    static defaultState: any = {};
  },
  mutation: () => (_target: any, _key: string, descriptor: any) => descriptor,
  Inject: () => (_target: any, _key: string) => {},
}));
jest.mock('services/scene-collections', () => ({ SceneCollectionsService: class {} }));
jest.mock('services/usage-statistics', () => ({ UsageStatisticsService: class {} }));
jest.mock('../internal-api', () => ({ InternalApiService: class {} }));

describe('TcpServerService', () => {
  let TcpServerService: any;
  let instance: any;
  let remoteEnv: Record<string, string | undefined>;
  let isDevMode: boolean;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    remoteEnv = {};
    isDevMode = false;

    jest.doMock('@electron/remote', () => ({
      process: { env: remoteEnv },
    }));
    jest.doMock('services/utils', () => ({
      __esModule: true,
      default: { isDevMode: () => isDevMode },
    }));

    ({ TcpServerService } = require('./tcp-server'));

    instance = Object.create(TcpServerService.prototype);
    instance.jsonrpcService = {
      createError: (request: any, error: any) => ({
        jsonrpc: '2.0',
        id: request?.id ?? null,
        error,
      }),
    };
    instance.internalApiService = {
      executeServiceRequest: jest.fn().mockReturnValue({ jsonrpc: '2.0', id: '1', result: true }),
      subscriptions: {},
    };
    instance.clients = {};
    instance.nextClientId = 1;
    instance.servers = [];
    instance.isRequestsHandlingStopped = false;
    instance.enableLogs = false;
    // namedPipe/websockets はデフォルトで無効にしておく。実際の named pipe に
    // listen してしまうと開発中に起動している n-air-app と衝突するため、
    // listen() を呼ぶテストでは createNamedPipeServer/createWebsoketsServer を
    // 個別にモックすること。
    instance.state = {
      ...TcpServerService.defaultState,
      namedPipe: { ...TcpServerService.defaultState.namedPipe, enabled: false },
    };
  });

  describe('shouldEnableTcp', () => {
    test('本番ビルド・環境変数なし・明示設定なしでは false', () => {
      expect(instance.shouldEnableTcp()).toBe(false);
    });

    test('dev モードでは true', () => {
      isDevMode = true;
      expect(instance.shouldEnableTcp()).toBe(true);
    });

    test('NAIR_ENABLE_TCP_API=1 であれば true', () => {
      remoteEnv.NAIR_ENABLE_TCP_API = '1';
      expect(instance.shouldEnableTcp()).toBe(true);
    });

    test('NAIR_ENABLE_TCP_API=true であれば true', () => {
      remoteEnv.NAIR_ENABLE_TCP_API = 'true';
      expect(instance.shouldEnableTcp()).toBe(true);
    });

    test('NAIR_ENABLE_TCP_API=0 (無効化の意図と読める値) では false', () => {
      remoteEnv.NAIR_ENABLE_TCP_API = '0';
      expect(instance.shouldEnableTcp()).toBe(false);
    });

    test('state.tcp.enabled が true であれば true', () => {
      instance.state = { ...instance.state, tcp: { enabled: true } };
      expect(instance.shouldEnableTcp()).toBe(true);
    });
  });

  describe('listen', () => {
    test('shouldEnableTcp が false のとき TCP サーバーを起動しない', () => {
      jest.spyOn(instance, 'shouldEnableTcp').mockReturnValue(false);
      jest.spyOn(instance, 'createTcpServer');
      jest.spyOn(instance, 'listenConnections').mockImplementation(() => {});

      instance.listen();

      expect(instance.createTcpServer).not.toHaveBeenCalled();
    });

    test('shouldEnableTcp が true のとき TCP サーバーを起動する', () => {
      jest.spyOn(instance, 'shouldEnableTcp').mockReturnValue(true);
      const fakeServer = { type: 'tcp', nativeServer: { on: jest.fn() }, close: jest.fn() };
      jest.spyOn(instance, 'createTcpServer').mockReturnValue(fakeServer);
      jest.spyOn(instance, 'listenConnections').mockImplementation(() => {});

      instance.listen();

      expect(instance.createTcpServer).toHaveBeenCalled();
      expect(instance.listenConnections).toHaveBeenCalledWith(fakeServer);
    });

    test('namedPipe/websockets は state.enabled のみで起動判定される（既存動作を変えない）', () => {
      jest.spyOn(instance, 'shouldEnableTcp').mockReturnValue(false);
      jest.spyOn(instance, 'listenConnections').mockImplementation(() => {});
      jest.spyOn(instance, 'createNamedPipeServer').mockReturnValue({});
      jest.spyOn(instance, 'createWebsoketsServer').mockReturnValue({});
      instance.state = {
        ...TcpServerService.defaultState,
        namedPipe: { enabled: true, pipeName: 'n-air-app' },
        websockets: { enabled: true, port: 59650, allowRemote: false },
      };

      instance.listen();

      expect(instance.createNamedPipeServer).toHaveBeenCalled();
      expect(instance.createWebsoketsServer).toHaveBeenCalled();
    });
  });

  describe('onConnectionHandler / クロスプロトコル攻撃の遮断', () => {
    function createSocket() {
      const handlers: Record<string, Function> = {};
      return {
        writable: true,
        remoteAddress: '127.0.0.1',
        on: jest.fn((event: string, cb: Function) => {
          handlers[event] = cb;
        }),
        write: jest.fn(),
        destroy: jest.fn(),
        end: jest.fn(),
        emit(event: string, ...args: any[]) {
          handlers[event]?.(...args);
        },
      };
    }

    test('HTTP メソッド行で始まるデータを受けたら即座に socket を破棄し、以降処理しない', () => {
      const socket = createSocket();
      jest.spyOn(instance, 'isLocalClient').mockReturnValue(true);
      const onRequestHandlerSpy = jest.spyOn(instance, 'onRequestHandler');

      instance.onConnectionHandler(socket, { type: 'tcp' });
      socket.emit(
        'data',
        Buffer.from(
          'POST / HTTP/1.1\r\nHost: 127.0.0.1:28194\r\n\r\n' +
            '{"jsonrpc":"2.0","id":1,"method":"write","params":{"resource":"FileManagerService","args":[]}}',
        ),
      );

      expect(socket.destroy).toHaveBeenCalled();
      expect(onRequestHandlerSpy).not.toHaveBeenCalled();
      expect(instance.internalApiService.executeServiceRequest).not.toHaveBeenCalled();
    });

    test('不正な JSON の行を受けたら socket を破棄し、以降の行は処理しない', () => {
      const socket = createSocket();
      jest.spyOn(instance, 'isLocalClient').mockReturnValue(true);

      instance.onConnectionHandler(socket, { type: 'tcp' });
      socket.emit(
        'data',
        Buffer.from(
          'not json\n{"jsonrpc":"2.0","id":1,"method":"write","params":{"resource":"FileManagerService","args":[]}}',
        ),
      );

      expect(socket.destroy).toHaveBeenCalled();
      expect(instance.internalApiService.executeServiceRequest).not.toHaveBeenCalled();
    });

    test('正規の JSON-RPC リクエストは従来どおり処理される', () => {
      const socket = createSocket();
      jest.spyOn(instance, 'isLocalClient').mockReturnValue(true);

      instance.onConnectionHandler(socket, { type: 'tcp' });
      socket.emit(
        'data',
        Buffer.from(
          JSON.stringify({
            jsonrpc: '2.0',
            id: '1',
            method: 'getScenes',
            params: { resource: 'ScenesService', args: [] },
          }) + '\n',
        ),
      );

      expect(socket.destroy).not.toHaveBeenCalled();
      expect(instance.internalApiService.executeServiceRequest).toHaveBeenCalledTimes(1);
      expect(socket.write).toHaveBeenCalled();
    });

    test('サービス呼び出しが例外を投げた場合、詳細を露出せず id を保持したエラーを返す', () => {
      const socket = createSocket();
      jest.spyOn(instance, 'isLocalClient').mockReturnValue(true);
      instance.internalApiService.executeServiceRequest.mockImplementation(() => {
        throw new Error('sensitive internal detail');
      });

      instance.onConnectionHandler(socket, { type: 'tcp' });
      socket.emit(
        'data',
        Buffer.from(
          JSON.stringify({
            jsonrpc: '2.0',
            id: '42',
            method: 'getScenes',
            params: { resource: 'ScenesService', args: [] },
          }) + '\n',
        ),
      );

      expect(socket.destroy).not.toHaveBeenCalled();
      expect(socket.write).toHaveBeenCalledTimes(1);
      const sent = JSON.parse((socket.write.mock.calls[0][0] as string).trim());
      expect(sent.id).toBe('42');
      expect(JSON.stringify(sent.error)).not.toContain('sensitive internal detail');
    });
  });
});
