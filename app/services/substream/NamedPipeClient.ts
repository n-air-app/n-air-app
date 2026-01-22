import * as net from 'net';

//    const PIPE_NAME = '\\\\.\\pipe\\NAirSubstream';

export class NamedPipeClient {
  name = '';
  client: net.Socket = undefined;
  lastPromise: Promise<any> = Promise.resolve();
  private buffer = '';

  queue = new Map<
    string,
    { resolve: (value: any) => void; reject: (reason?: any) => void; timeout: NodeJS.Timeout }
  >();

  constructor(name: string) {
    this.name = name;
  }

  // バッファ内で完全なJSONオブジェクトの終端位置を探す
  // @returns 完全なJSONの終端位置（次の文字の位置）、見つからない場合は-1
  // @internal テスト用にpublic
  public findCompleteJson(str: string): number {
    let depth = 0;
    let inString = false;
    let escaping = false;

    for (let i = 0; i < str.length; i++) {
      const char = str[i];

      if (escaping) {
        escaping = false;
        continue;
      }

      if (char === '\\' && inString) {
        escaping = true;
        continue;
      }

      if (char === '"') {
        inString = !inString;
        continue;
      }

      if (inString) continue;

      if (char === '{') {
        depth++;
      } else if (char === '}') {
        depth--;
        if (depth === 0) {
          return i + 1; // JSONの終端位置（次の文字の位置）
        }
      }
    }

    return -1; // 完全なJSONが見つからない
  }

  private async open(): Promise<void> {
    if (this.client) return;

    // 再接続時は前のバッファをクリア
    this.buffer = '';

    return new Promise((resolve, reject) => {
      const client = net.createConnection(this.name, () => {
        this.client = client;
        resolve();
      });

      client.on('end', () => {
        this.buffer = '';
        this.client = undefined;
      });
      client.on('error', (err: Error) => {
        this.buffer = '';
        this.client = undefined;
        reject(err);
      });

      client.on('data', (data: Buffer) => {
        // データをバッファに追加
        this.buffer += data.toString();

        // 完全なJSONメッセージを抽出して処理
        while (true) {
          const jsonEnd = this.findCompleteJson(this.buffer);
          if (jsonEnd === -1) break;

          const message = this.buffer.substring(0, jsonEnd);
          this.buffer = this.buffer.substring(jsonEnd);

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
            // パースエラーが起きたらバッファをクリアして再同期
            this.buffer = '';
            break;
          }
        }
      });
    });
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
      }, 1000);

      this.queue.set(id, { resolve, reject, timeout });
      this.client.write(JSON.stringify({ id, fn, arg }));
      //      console.log('np-send:', JSON.stringify({ id, fn, arg }));
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
