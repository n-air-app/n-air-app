import * as net from 'net';

//    const PIPE_NAME = '\\\\.\\pipe\\NAirSubstream';

const CONNECTION_TIMEOUT_MS = 1000;
const REQUEST_TIMEOUT_MS = 1000;

export class NamedPipeClient {
  name = '';
  client: net.Socket | undefined = undefined;
  lastPromise: Promise<any> = Promise.resolve();
  private buffer = '';

  queue = new Map<
    string,
    { resolve:(value: any) => void; reject: (reason?: any) => void; timeout: NodeJS.Timeout }
  >();

  constructor(name: string) {
    this.name = name;
  }

  private async open(): Promise<void> {
    if (this.client) return;

    // 再接続時は前のバッファをクリア
    this.buffer = '';

    return new Promise((resolve, reject) => {
      let settled = false;
      const client = net.createConnection(this.name, () => {
        if (settled) {
          client.destroy();
          return;
        }
        settled = true;
        clearTimeout(connectionTimeout);
        this.client = client;
        resolve();
      });

      const connectionTimeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        client.destroy();
        reject(new Error('Connection timed out'));
      }, CONNECTION_TIMEOUT_MS);

      client.on('end', () => {
        if (!settled) {
          settled = true;
          clearTimeout(connectionTimeout);
          reject(new Error('Connection closed'));
        }
        this.close();
      });
      client.on('error', (err: Error) => {
        if (settled) {
          this.close();
          return;
        }
        settled = true;
        clearTimeout(connectionTimeout);
        client.destroy();
        reject(err);
      });

      client.on('data', (data: Buffer) => {
        // データをバッファに追加
        this.buffer += data.toString();

        // 改行で分割してメッセージを処理
        const lines = this.buffer.split('\n');
        // 最後の要素は未完成の可能性があるため残す
        this.buffer = lines.pop() || '';

        for (const line of lines) {
          const message = line.trim();
          if (!message) continue; // 空行をスキップ

          try {
            const response = JSON.parse(message);

            if (response.id) {
              const r = this.queue.get(response.id);
              if (r) {
                clearTimeout(r.timeout);
                this.queue.delete(response.id);
                const result = response.res ?? {};
                r.resolve(result);
              }
            } else {
              console.log('no id:', message);
            }
          } catch (err) {
            console.error('Invalid response format:', message, err);
          }
        }
      });
    });
  }

  private clearQueue(): void {
    for (const item of this.queue.values()) {
      clearTimeout(item.timeout);
      item.reject(new Error('Connection closed'));
    }
    this.queue.clear();
  }

  close(): void {
    if (this.client) {
      this.client.destroy();
      this.client = undefined;
    }
    this.buffer = '';
    this.clearQueue();
  }

  // {id, fn, arg} を送信
  // id は一意のリクエスト ID
  // fn は呼び出す関数名
  // arg は関数の引数
  // レスポンスは {id, res} の形式で返される
  // id はリクエスト ID
  // res は関数の戻り値

  async callEx(fn: string, arg: { [name: string]: any } = {}): Promise<{ [name: string]: any }> {
    await this.open();

    return new Promise((resolve, reject) => {
      const id = Math.random().toString(36).substring(2, 10);

      const timeout = setTimeout(() => {
        this.queue.delete(id);
        reject(new Error('Request timed out'));
      }, REQUEST_TIMEOUT_MS);

      this.queue.set(id, { resolve, reject, timeout });
      this.client!.write(JSON.stringify({ id, fn, arg }) + '\n');
    });
  }

  async call(fn: string, arg: { [name: string]: any } = {}): Promise<{ [name: string]: any }> {
    try {
      return await this.callEx(fn, arg);
    } catch (err) {
      return {};
    }
  }
}
