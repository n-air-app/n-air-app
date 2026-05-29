import { IpcRequestError } from './ipc-request-error';

describe('IpcRequestError', () => {
  test('message に serviceName.methodName が含まれる', () => {
    const err = new IpcRequestError('FooService', 'barMethod', { code: -32603, message: 'original error' });
    expect(err.message).toBe('IPC request failed: FooService.barMethod');
  });

  test('name が IpcRequestError である', () => {
    const err = new IpcRequestError('FooService', 'barMethod', { code: -32603 });
    expect(err.name).toBe('IpcRequestError');
  });

  test('rpcError / serviceName / methodName が保持される', () => {
    const rpcError = { code: -32603, message: 'test error' };
    const err = new IpcRequestError('FooService', 'barMethod', rpcError);
    expect(err.rpcError).toBe(rpcError);
    expect(err.serviceName).toBe('FooService');
    expect(err.methodName).toBe('barMethod');
  });

  test('instanceof Error / IpcRequestError がともに true', () => {
    const err = new IpcRequestError('FooService', 'barMethod', { code: -32603 });
    expect(err instanceof Error).toBe(true);
    expect(err instanceof IpcRequestError).toBe(true);
  });
});
