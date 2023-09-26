import net from 'net';
import { WaveFile } from 'wavefile';

const pipePath = '\\\\.\\pipe\\comment_audio';
let pipeClient: net.Socket = null;

async function getClient(): Promise<net.Socket | null> {
  if (pipeClient) return pipeClient;

  return new Promise((resolve, reject) => {
    const client = net.connect(pipePath, () => {
      console.log('connected');
      client.setTimeout(0);
      client.on('close', () => {
        console.log('closed');
        pipeClient = null;
      });
      pipeClient = client;
      resolve(client);
    });

    client.setTimeout(50, () => {
      console.log('to');
      client.destroy();
      reject(new Error('not reached'));
    });

    client.on('error', err => {
      reject(err);
    });
  });
}

function makeSendData(wave: Buffer) {
  const w = new WaveFile(wave);
  const h = Buffer.alloc(16);
  w.toBitDepth('16'); // force fix

  const wdata = w.data as any;
  const wfmt = w.fmt as any;

  // レベルメータを落とすため 16bit 100ms x 2 , plugin側が100ms毎なので
  const suffixLength = wfmt.sampleRate * 0.2;
  const suffix = Buffer.alloc(suffixLength * 2);

  // console.log(w.fmt);
  // console.log(wdata.samples.length);
  h.writeUInt16LE(0x2525, 0);
  h.writeUInt16LE(16, 2);
  h.writeUInt32LE(wdata.samples.length + suffixLength, 4);
  h.writeUInt16LE(wfmt.sampleRate, 8);
  h.writeUInt16LE(wfmt.bitsPerSample, 10);
  h.writeUInt32LE(0, 12);

  // console.log(h);
  const r = Buffer.concat([h, wdata.samples, suffix]);
  return r;
}

export async function isPlayableComment(): Promise<boolean> {
  try {
    const client = await getClient();
    return client != null;
  } catch (e) {}
  return false;
}

export async function playComment(buffer: Buffer): Promise<void> {
  try {
    const client = await getClient();
    const r = makeSendData(buffer);
    client.write(r);
  } catch (e) {
    console.log(e);
  }
}
