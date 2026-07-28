import { IpcRequestError } from './ipc-request-error';
import { isObsBackendIpcLost, isObsBackendIpcLostMessage } from './obs-ipc-error';

describe('isObsBackendIpcLostMessage', () => {
  test('Failed to make IPC call, verify IPC status. を含む文字列を true と判定する', () => {
    expect(isObsBackendIpcLostMessage('INTERNAL_SERVER_ERROR Failed to make IPC call, verify IPC status.')).toBe(true);
  });

  test('Lost IPC Connection を含む文字列を true と判定する', () => {
    expect(isObsBackendIpcLostMessage('Uncaught Error: Lost IPC Connection')).toBe(true);
  });

  test('無関係な文字列は false', () => {
    expect(isObsBackendIpcLostMessage('some other error')).toBe(false);
  });

  test('undefined は false', () => {
    expect(isObsBackendIpcLostMessage(undefined)).toBe(false);
  });

  test('null は false', () => {
    expect(isObsBackendIpcLostMessage(null)).toBe(false);
  });

  test('空文字は false', () => {
    expect(isObsBackendIpcLostMessage('')).toBe(false);
  });
});

describe('isObsBackendIpcLost', () => {
  test('生の Error（メインウィンドウでのネイティブ例外）を true と判定する', () => {
    expect(isObsBackendIpcLost(new Error('Failed to make IPC call, verify IPC status.'))).toBe(true);
  });

  test('Lost IPC Connection の生の Error も true と判定する', () => {
    expect(isObsBackendIpcLost(new Error('Lost IPC Connection'))).toBe(true);
  });

  test('IpcRequestError の rpcError.message で判定する', () => {
    const err = new IpcRequestError('SourcesService', 'getAvailableSourcesTypesList', {
      code: -32000,
      message: 'INTERNAL_SERVER_ERROR Failed to make IPC call, verify IPC status.',
    });
    expect(isObsBackendIpcLost(err)).toBe(true);
  });

  test('IpcRequestError で rpcError.message が undefined なら false', () => {
    const err = new IpcRequestError('SourcesService', 'getAvailableSourcesTypesList', {
      code: -32000,
    });
    expect(isObsBackendIpcLost(err)).toBe(false);
  });

  test('string を直接渡しても判定できる', () => {
    expect(isObsBackendIpcLost('Failed to make IPC call, verify IPC status.')).toBe(true);
  });

  test('message プロパティを持つ非 Error オブジェクトも判定する', () => {
    expect(isObsBackendIpcLost({ message: 'Lost IPC Connection' })).toBe(true);
  });

  test('null を渡しても throw せず false を返す', () => {
    expect(isObsBackendIpcLost(null)).toBe(false);
  });

  test('undefined を渡しても throw せず false を返す', () => {
    expect(isObsBackendIpcLost(undefined)).toBe(false);
  });

  test('無関係な Error は false', () => {
    expect(isObsBackendIpcLost(new Error('some other error'))).toBe(false);
  });

  test('message プロパティのない値は false', () => {
    expect(isObsBackendIpcLost(42)).toBe(false);
  });
});
