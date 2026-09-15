import { randomUUID } from 'crypto';
import { join } from 'path';

import { getNVoicePath } from '@n-air-app/n-voice-package';
import { access } from 'fs/promises';

import { NVoiceClient } from './NVoiceClient';

describe('NVoiceClient', () => {
  const dir = getNVoicePath();
  let client: NVoiceClient;

  beforeEach(() => {
    client = new NVoiceClient({
      baseDir: dir,
      onError: (err: Error) => {
        console.error(err);
      },
    });
  });

  afterEach(async () => {
    // エンジンプロセスが起動していれば終了を待つ
    if (client.loaded()) {
      (client as any).commandLineClient?.kill();
    }
  });

  test('empty', async () => {
    const filename = join(dir, `test-${randomUUID()}.wav`);
    expect((await client.talk(1.0, '', filename)).wave).toBeNull();
  });

  test('"テスト"', async () => {
    const filename = join(dir, `test-${randomUUID()}.wav`);
    const { wave, labels } = await client.talk(1.0, 'テスト', filename);
    expect(wave).not.toBeNull();
    expect(labels.map((l) => l.phoneme)).toEqual([
      'silB',
      't',
      'e',
      's',
      'U',
      't',
      'o',
      'silE',
    ]);
    await expect(access(filename)).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(access(filename + '.txt')).rejects.toMatchObject({
      code: 'ENOENT',
    });
  }, 20000 /* longer timeout */);
});
