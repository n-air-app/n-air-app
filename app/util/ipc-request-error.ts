export class IpcRequestError extends Error {
  constructor(
    public readonly serviceName: string,
    public readonly methodName: string,
    public readonly rpcError: { code: number; message?: string },
  ) {
    super(`IPC request failed: ${serviceName}.${methodName}`);
    this.name = new.target.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
