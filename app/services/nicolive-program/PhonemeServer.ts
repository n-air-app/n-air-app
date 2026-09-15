import { createServer } from 'http';

import { Server } from 'socket.io';

export class PhonemeServer {
  io: Server;

  constructor({ onPortAssigned }: { onPortAssigned: (port: number) => void }) {
    try {
      const server = createServer();
      server.listen(0, '127.0.0.1', () => {
        const address = server.address();
        if (address !== null && typeof address === 'object') {
          console.log('PhonemeServer: socket.io listening on', address.port);
          onPortAssigned(address.port);
        }
      });
      this.io = new Server(server, {
        // 音素ごとの HTTP polling を避け、ローカル接続だけを WebSocket で維持する
        transports: ['websocket'],
      });
    } catch (e) {
      console.error('socket.io constructor error', e);
    }
  }

  emitPhoneme(phoneme: string) {
    if (!this.io) return;
    this.io.emit('phoneme', phoneme);
  }
}
