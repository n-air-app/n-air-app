import * as Sentry from '@sentry/vue';

import { IpcRequestError } from './ipc-request-error';
import { captureIpcRequestError } from './sentry-ipc-request';

jest.mock('@sentry/vue', () => ({
  addBreadcrumb: jest.fn(),
  withScope: jest.fn(),
  captureException: jest.fn(),
}));

describe('captureIpcRequestError', () => {
  let mockScope: {
    setLevel: jest.Mock;
    setTag: jest.Mock;
    setExtra: jest.Mock;
    setFingerprint: jest.Mock;
    setContext: jest.Mock;
    captureException: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockScope = {
      setLevel: jest.fn(),
      setTag: jest.fn(),
      setExtra: jest.fn(),
      setFingerprint: jest.fn(),
      setContext: jest.fn(),
      captureException: jest.fn(),
    };
    (Sentry.withScope as jest.Mock).mockImplementation((cb) => cb(mockScope));
  });

  test('IpcRequestError を返す', () => {
    const rpcError = { code: -32603, message: 'main error' };
    const result = captureIpcRequestError('FooService', 'barMethod', false, undefined, rpcError);
    expect(result).toBeInstanceOf(IpcRequestError);
    expect(result.message).toBe('IPC request failed: FooService.barMethod');
  });

  test('breadcrumb に service/method/code が記録される', () => {
    captureIpcRequestError('FooService', 'barMethod', false, undefined, { code: -32603 });
    expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
      category: 'ipc.request',
      message: 'FooService.barMethod failed (code: -32603)',
      level: 'error',
    });
  });

  test('scope に service / method タグがセットされる', () => {
    captureIpcRequestError('FooService', 'barMethod', false, undefined, { code: -32603 });
    expect(mockScope.setTag).toHaveBeenCalledWith('service', 'FooService');
    expect(mockScope.setTag).toHaveBeenCalledWith('method', 'barMethod');
  });

  test('helper 時は resourceId タグがセットされる', () => {
    captureIpcRequestError('FooService', 'barMethod', true, 'resource-123', { code: -32603 });
    expect(mockScope.setTag).toHaveBeenCalledWith('isHelper', 'true');
    expect(mockScope.setTag).toHaveBeenCalledWith('resourceId', 'resource-123');
  });

  test('helper でない場合は resourceId タグがセットされない', () => {
    captureIpcRequestError('FooService', 'barMethod', false, undefined, { code: -32603 });
    const resourceIdCall = (mockScope.setTag as jest.Mock).mock.calls.find(
      ([key]) => key === 'resourceId',
    );
    expect(resourceIdCall).toBeUndefined();
  });

  test('mainError extra に rpcError.message がセットされる', () => {
    captureIpcRequestError('FooService', 'barMethod', false, undefined, {
      code: -32603,
      message: 'original stack',
    });
    expect(mockScope.setExtra).toHaveBeenCalledWith('mainError', 'original stack');
  });

  test('rpcError.message がない場合は (no message) がセットされる', () => {
    captureIpcRequestError('FooService', 'barMethod', false, undefined, { code: -32603 });
    expect(mockScope.setExtra).toHaveBeenCalledWith('mainError', '(no message)');
  });

  test('fingerprint が固定文字列 + service.method で分割される', () => {
    captureIpcRequestError('FooService', 'barMethod', false, undefined, { code: -32603 });
    expect(mockScope.setFingerprint).toHaveBeenCalledWith(['IpcRequestError', 'FooService', 'barMethod']);
  });

  test('captureException が呼ばれる', () => {
    captureIpcRequestError('FooService', 'barMethod', false, undefined, { code: -32603 });
    expect(Sentry.captureException).toHaveBeenCalled();
    const captured = (Sentry.captureException as jest.Mock).mock.calls[0][0];
    expect(captured).toBeInstanceOf(IpcRequestError);
  });

  test('symbol の methodName も文字列に変換される', () => {
    const sym = Symbol('myMethod');
    const result = captureIpcRequestError('FooService', sym, false, undefined, { code: -32603 });
    expect(result.methodName).toBe('Symbol(myMethod)');
    expect(mockScope.setTag).toHaveBeenCalledWith('method', 'Symbol(myMethod)');
  });

  test('通常の rpcError では ipc.mainErrorKind が other になり level は error のまま', () => {
    captureIpcRequestError('FooService', 'barMethod', false, undefined, {
      code: -32603,
      message: 'some other error',
    });
    expect(mockScope.setTag).toHaveBeenCalledWith('ipc.mainErrorKind', 'other');
    expect(mockScope.setLevel).toHaveBeenCalledWith('error');
    expect(mockScope.setFingerprint).toHaveBeenCalledWith(['IpcRequestError', 'FooService', 'barMethod']);
  });

  test('OBSバックエンドIPC切断エラーは warning に降格され専用 fingerprint になる', () => {
    captureIpcRequestError('SourcesService', 'getAvailableSourcesTypesList', false, undefined, {
      code: -32000,
      message: 'INTERNAL_SERVER_ERROR Failed to make IPC call, verify IPC status.',
    });
    expect(mockScope.setTag).toHaveBeenCalledWith('ipc.mainErrorKind', 'obsBackendIpcLost');
    expect(mockScope.setLevel).toHaveBeenCalledWith('warning');
    expect(mockScope.setFingerprint).toHaveBeenCalledWith(['IpcRequestError', 'ObsBackendIpcLost']);
  });

  test('OBSバックエンドIPC切断エラーは breadcrumb の level も warning になる', () => {
    captureIpcRequestError('SourcesService', 'getAvailableSourcesTypesList', false, undefined, {
      code: -32000,
      message: 'INTERNAL_SERVER_ERROR Failed to make IPC call, verify IPC status.',
    });
    expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
      category: 'ipc.request',
      message: 'SourcesService.getAvailableSourcesTypesList failed (code: -32000)',
      level: 'warning',
    });
  });
});
