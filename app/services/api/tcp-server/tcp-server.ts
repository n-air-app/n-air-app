import WritableStream = NodeJS.WritableStream;
import crypto from 'crypto';
import os from 'os';

import * as remote from '@electron/remote';
import {
  E_JSON_RPC_ERROR,
  IJsonRpcEvent,
  IJsonRpcRequest,
  IJsonRpcResponse,
  JsonrpcService,
} from 'services/api/jsonrpc/index';
import { Inject, mutation, PersistentStatefulService } from 'services/core';
import { SceneCollectionsService } from 'services/scene-collections';
import { UsageStatisticsService } from 'services/usage-statistics';
import Utils from 'services/utils';

import { InternalApiService } from '../internal-api';

import { IIPAddressDescription, ITcpServerServiceApi, ITcpServersSettings } from './tcp-server-api';

const net = require('net');

const LOCAL_HOST_NAME = '127.0.0.1';
const WILDCARD_HOST_NAME = '0.0.0.0';

interface IClient {
  id: number;
  socket: WritableStream;
  subscriptions: string[];
  isAuthorized: boolean;

  /**
   * Clients with listenAllSubscriptions=true receive events that have been sent to other clients.
   * This is helpful for tests.
   */
  listenAllSubscriptions: boolean;
}

interface IServer {
  type: string;
  nativeServer: {
    on(eventName: string, cb: (event: any) => any): any;
  };
  close(): void;
}

const TCP_PORT = 28194;

/**
 * A transport layer for TCP and Websockets communications with internal API
 */
export class TcpServerService
  extends PersistentStatefulService<ITcpServersSettings>
  implements ITcpServerServiceApi {
  static defaultState: ITcpServersSettings = {
    token: '',
    tcp: {
      enabled: false,
    },
    namedPipe: {
      enabled: true,
      pipeName: 'n-air-app',
    },
    websockets: {
      enabled: false,
      port: 59650,
      allowRemote: false,
    },
  };

  @Inject() private jsonrpcService: JsonrpcService;
  @Inject() private usageStatisticsService: UsageStatisticsService;
  @Inject() private internalApiService: InternalApiService;
  private clients: Dictionary<IClient> = {};
  private nextClientId = 1;
  private servers: IServer[] = [];
  private isRequestsHandlingStopped = false;

  // enable to debug
  private enableLogs = false;

  init() {
    super.init();
    this.internalApiService.serviceEvent.subscribe((event) => this.onServiceEventHandler(event));
  }

  listen() {
    // TCP (127.0.0.1:28194) は認証なしでローカルの任意のプロセス・ブラウザから
    // 到達可能なため、本番ビルドではデフォルトで listen しない。
    // 開発時のデバッグ用途や、明示的な設定・環境変数による opt-in は維持する。
    if (this.shouldEnableTcp()) this.listenConnections(this.createTcpServer());
    if (this.state.namedPipe.enabled) this.listenConnections(this.createNamedPipeServer());
    if (this.state.websockets.enabled) this.listenConnections(this.createWebsoketsServer());
  }

  private shouldEnableTcp(): boolean {
    return (
      this.state.tcp.enabled ||
      Utils.isDevMode() ||
      ['1', 'true'].includes(remote.process.env.NAIR_ENABLE_TCP_API ?? '')
    );
  }

  /**
   * stop handle any requests
   * each API request will be responded with "API is busy" error
   * this method doesn't stop event emitting
   */
  stopRequestsHandling() {
    this.isRequestsHandlingStopped = true;
  }

  startRequestsHandling() {
    this.isRequestsHandlingStopped = false;
  }

  stopListening() {
    this.servers.forEach((server) => server.close());
    Object.keys(this.clients).forEach((clientId) => this.disconnectClient(Number(clientId)));
  }

  enableWebsoketsRemoteConnections() {
    this.stopListening();

    // update websockets settings
    const defaultWebsoketsSettings = this.getDefaultSettings().websockets;
    this.setSettings({
      websockets: {
        ...defaultWebsoketsSettings,
        enabled: true,
        allowRemote: true,
      },
    });

    this.listen();
  }

  getDefaultSettings(): ITcpServersSettings {
    return TcpServerService.defaultState;
  }

  setSettings(settings: Partial<ITcpServersSettings>) {
    const needToGenerateToken =
      settings.websockets && settings.websockets.allowRemote && !this.state.token;
    if (needToGenerateToken) this.generateToken();
    this.SET_SETTINGS(settings);
  }

  getSettings(): ITcpServersSettings {
    return this.state;
  }

  getIPAddresses(): IIPAddressDescription[] {
    const ifaces = os.networkInterfaces();
    const addresses: IIPAddressDescription[] = [];
    Object.keys(ifaces).forEach((ifaceName) => {
      const iface = ifaces[ifaceName];
      if (!iface) return;
      iface.forEach((interfaceInfo) => {
        addresses.push({
          interface: ifaceName,
          address: interfaceInfo.address,
          family: interfaceInfo.family,
          internal: interfaceInfo.internal,
        });
      });
    });
    return addresses;
  }

  generateToken(): string {
    const buf = new Uint8Array(20);
    crypto.randomFillSync(buf);
    let token = '';
    buf.forEach((val) => (token += val.toString(16)));
    this.setSettings({ token });
    return token;
  }

  private listenConnections(server: IServer) {
    this.servers.push(server);

    server.nativeServer.on('connection', (socket) => this.onConnectionHandler(socket, server));

    server.nativeServer.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        console.warn(`TcpServerService: ${server.type} server failed to listen: ${error.message}`);
        return;
      }
      throw error;
    });
  }

  private createNamedPipeServer(): IServer {
    const settings = this.state.namedPipe;
    const server = net.createServer();
    server.listen(`\\\\.\\pipe\\${settings.pipeName}`);
    return {
      type: 'namedPipe',
      nativeServer: server,
      close() {
        server.close();
      },
    };
  }

  private createTcpServer(): IServer {
    const server = net.createServer();
    server.listen(TCP_PORT, LOCAL_HOST_NAME);
    return {
      type: 'tcp',
      nativeServer: server,
      close() {
        server.close();
      },
    };
  }

  private createWebsoketsServer(): IServer {
    const settings = this.state.websockets;
    const http = require('http');
    const sockjs = require('sockjs');
    const websocketsServer = sockjs.createServer();
    const httpServer = http.createServer();
    websocketsServer.installHandlers(httpServer, { prefix: '/api' });
    httpServer.listen(settings.port, settings.allowRemote ? WILDCARD_HOST_NAME : LOCAL_HOST_NAME);
    return {
      type: 'websockets',
      nativeServer: websocketsServer,
      close() {
        httpServer.close();
      },
    };
  }

  private onConnectionHandler(socket: WritableStream, server: IServer) {
    this.log('new connection', socket);

    const id = this.nextClientId++;
    const client: IClient = {
      id,
      socket,
      subscriptions: [],
      listenAllSubscriptions: false,
      isAuthorized: false,
    };
    this.clients[id] = client;

    if (server.type === 'namedPipe' || this.isLocalClient(client)) {
      this.authorizeClient(client);
    }

    socket.on('data', (data: any) => {
      const dataString = data.toString();

      // Defend against cross-protocol attacks: a webpage can send an HTTP
      // request to this TCP socket (e.g. via fetch()/XHR to 127.0.0.1). Its
      // request line/headers fail JSON-RPC parsing and are ignored by
      // onRequestHandler, but nothing prevented a JSON-RPC line hidden in the
      // request body from being executed. Detect the HTTP request line up
      // front and destroy the connection before any parsing happens.
      if (this.looksLikeHttpRequest(dataString)) {
        console.debug('TCP Server: received an HTTP request, disconnecting client');
        this.destroyClient(client);
        return;
      }

      this.onRequestHandler(client, dataString);
    });

    socket.on('end', () => {
      this.onDisconnectHandler(client);
    });

    socket.on('close', () => {
      this.onDisconnectHandler(client);
    });

    socket.on('error', (e: NodeJS.ErrnoException) => {
      if (e.code === 'EPIPE' || e.code === 'ERR_STREAM_WRITE_AFTER_END') {
        // Expected errors from closed/ended connections
        console.debug('TCP Server: Socket was disconnected', e);
        this.onDisconnectHandler(client);
      } else {
        throw e;
      }
    });
  }

  private authorizeClient(client: IClient) {
    client.isAuthorized = true;
  }

  private static readonly HTTP_METHOD_PREFIXES = [
    'GET ',
    'POST ',
    'PUT ',
    'HEAD ',
    'DELETE ',
    'OPTIONS ',
    'PATCH ',
    'CONNECT ',
    'TRACE ',
  ];

  private looksLikeHttpRequest(data: string): boolean {
    return TcpServerService.HTTP_METHOD_PREFIXES.some((prefix) => data.startsWith(prefix));
  }

  private isLocalClient(client: IClient) {
    const localAddresses = this.getIPAddresses()
      .filter((addressDescr) => addressDescr.internal)
      .map((addressDescr) => addressDescr.address);
    return localAddresses.includes((client.socket as any).remoteAddress);
  }

  private onRequestHandler(client: IClient, data: string) {
    this.log('tcp request', data);

    if (this.isRequestsHandlingStopped) {
      this.sendResponse(
        client,
        this.jsonrpcService.createError(null, {
          code: E_JSON_RPC_ERROR.INTERNAL_JSON_RPC_ERROR,
          message: 'API server is busy. Try again later',
        }),
      );

      return;
    }

    const requests = data.split('\n');
    for (const requestString of requests) {
      if (!requestString) continue;

      let request: IJsonRpcRequest;
      try {
        request = JSON.parse(requestString);
      } catch (e) {
        // The received line isn't valid JSON-RPC. This happens when a raw HTTP
        // request reaches this socket (e.g. a malicious webpage doing a
        // cross-protocol attack via fetch()/XHR against 127.0.0.1). Disconnect
        // immediately instead of responding with an error: continuing to parse
        // the remaining lines would let an HTTP request body that happens to
        // look like JSON-RPC get executed.
        console.debug('TCP Server: received a non-JSON-RPC request, disconnecting client', e);
        this.destroyClient(client);
        return;
      }

      try {
        const errorMessage = this.validateRequest(request);

        if (errorMessage) {
          const errorResponse = this.jsonrpcService.createError(request, {
            code: E_JSON_RPC_ERROR.INVALID_PARAMS,
            message: errorMessage,
          });
          this.sendResponse(client, errorResponse);
          continue;
        }

        // some requests have to be handled by TcpServerService
        if (this.hadleTcpServerDirectives(client, request)) continue;

        const response = this.internalApiService.executeServiceRequest(request);

        // if response is subscription then add this subscription to client
        if (response.result && response.result._type === 'SUBSCRIPTION') {
          const subscriptionId = response.result.resourceId;
          if (!client.subscriptions.includes(subscriptionId)) {
            client.subscriptions.push(subscriptionId);
          }
        }

        this.sendResponse(client, response);
      } catch (e) {
        console.error('TCP Server: error while processing the request', e);
        this.sendResponse(
          client,
          this.jsonrpcService.createError(request, {
            code: E_JSON_RPC_ERROR.INTERNAL_SERVER_ERROR,
          }),
        );
      }
    }
  }

  private onServiceEventHandler(event: IJsonRpcResponse<IJsonRpcEvent>) {
    const result = event.result;
    if (!result) return;

    // send event to subscribed clients
    Object.keys(this.clients).forEach((clientId) => {
      const client = this.clients[clientId];
      const eventName = result.resourceId.split('.')[1];

      // these events will be sent to the client even if isRequestsHandlingStopped = true
      // this allows to send this event even if the app is in the loading state
      const whitelistedEvents: (keyof SceneCollectionsService)[] = [
        'collectionWillSwitch',
        'collectionAdded',
        'collectionRemoved',
        'collectionSwitched',
        'collectionUpdated',
      ];
      const force = (whitelistedEvents as string[]).includes(eventName);

      const needToSendEvent =
        client.listenAllSubscriptions || client.subscriptions.includes(result.resourceId);
      if (needToSendEvent) this.sendResponse(client, event, force);
    });
  }

  private validateRequest(request: IJsonRpcRequest): string {
    let message = '';
    if (!request.id) message += ' id is required;';
    if (!request.params) message += ' params is required;';
    if (request.params && !request.params.resource) message += ' resource is required;';
    return message;
  }

  private hadleTcpServerDirectives(client: IClient, request: IJsonRpcRequest) {
    // handle auth
    if (request.method === 'auth' && request.params.resource === 'TcpServerService') {
      if (this.state.token && request.params.args?.[0] === this.state.token) {
        this.authorizeClient(client);
        this.sendResponse(client, {
          jsonrpc: '2.0',
          id: request.id,
          result: true,
        });
      } else {
        this.sendResponse(
          client,
          this.jsonrpcService.createError(request, {
            code: E_JSON_RPC_ERROR.INTERNAL_JSON_RPC_ERROR,
            message: 'Invalid token',
          }),
        );
      }

      return true;
    }

    if (!client.isAuthorized) {
      this.sendResponse(
        client,
        this.jsonrpcService.createError(request, {
          code: E_JSON_RPC_ERROR.INTERNAL_JSON_RPC_ERROR,
          message: 'Authorization required. Use TcpServerService.auth(token) method',
        }),
      );
      return true;
    }

    // handle unsubscribing by clearing client subscriptions
    if (
      request.method === 'unsubscribe' &&
      this.internalApiService.subscriptions[request.params.resource]
    ) {
      const subscriptionInd = client.subscriptions.indexOf(request.params.resource);
      if (subscriptionInd !== -1) client.subscriptions.splice(subscriptionInd, 1);
      this.sendResponse(client, {
        jsonrpc: '2.0',
        id: request.id,
        result: subscriptionInd !== -1,
      });
      return true;
    }

    // handle `listenAllSubscriptions` directive
    if (
      request.method === 'listenAllSubscriptions' &&
      request.params.resource === 'TcpServerService'
    ) {
      client.listenAllSubscriptions = true;
      this.sendResponse(client, {
        jsonrpc: '2.0',
        id: request.id,
        result: true,
      });
      return true;
    }
  }

  private onDisconnectHandler(client: IClient) {
    this.log('client disconnected');
    delete this.clients[client.id];
  }

  private sendResponse(client: IClient, response: IJsonRpcResponse<any>, force = false) {
    if (this.isRequestsHandlingStopped && !force) return;

    this.log('send response', response);

    // ERR_STREAM_WRITE_AFTER_END is emitted asynchronously and bypasses the try/catch below.
    if (!client.socket.writable) return;

    // unhandled exceptions completely destroy Rx.Observable subscription
    try {
      client.socket.write(`${JSON.stringify(response)}\n`);
    } catch (e) {
      // probably the client has been silently disconnected
      console.info('unable to send response', response, e);
    }
  }

  private disconnectClient(clientId: number) {
    const client = this.clients[clientId];
    client.socket.end();
    delete this.clients[clientId];
  }

  /**
   * Immediately terminates the connection without sending any response.
   * Used when the client sent data that isn't a valid JSON-RPC request
   * (see onRequestHandler), so no assumption about the protocol being spoken
   * on this socket can be made anymore.
   */
  private destroyClient(client: IClient) {
    (client.socket as any).destroy();
    delete this.clients[client.id];
  }

  private log(...messages: any[]) {
    if (!this.enableLogs) return;
    console.log(...messages);
  }

  @mutation()
  private SET_SETTINGS(patch: Partial<ITcpServersSettings>) {
    this.state = { ...this.state, ...patch };
  }
}
