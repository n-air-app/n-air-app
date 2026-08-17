import type { spawn as spawnType, spawnSync as spawnSyncType } from 'node:child_process';
import { EventEmitter } from 'node:events';

import { jest_fn } from 'util/jest_fn';

// spawn したプロセスの最小限のモック。stdout/stderr を持つ EventEmitter として振る舞う。
class FakeChildProcess extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  killed = false;

  kill() {
    this.killed = true;
  }
}

jest.mock('node:child_process', () => ({
  spawn: jest_fn<typeof spawnType>().mockName('spawn'),
  spawnSync: jest_fn<typeof spawnSyncType>().mockName('spawnSync'),
}));
jest.mock('node:fs', () => ({
  existsSync: jest_fn<() => boolean>().mockName('existsSync').mockReturnValue(true),
  statSync: jest_fn<() => { isDirectory(): boolean }>()
    .mockName('statSync')
    .mockReturnValue({ isDirectory: () => true }),
}));

describe('VoskClient', () => {
  let spawnMock: jest.Mock;
  let fakeProcesses: FakeChildProcess[];

  beforeEach(() => {
    jest.resetModules();
    const { spawn } = require('node:child_process');
    spawnMock = spawn;
    fakeProcesses = [];
    spawnMock.mockImplementation(() => {
      const proc = new FakeChildProcess();
      fakeProcesses.push(proc);
      return proc;
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  function createClient(audioDeviceId?: string | null) {
    const { VoskClient } = require('./VoskClient');
    return new VoskClient({
      voskCliPath: '/fake/vosk-cli.exe',
      modelPath: '/fake/model',
      audioDeviceId,
    });
  }

  it('does not pass a device flag when audioDeviceId is not specified', () => {
    const client = createClient();
    client.startTranscription();

    expect(spawnMock).toHaveBeenCalledTimes(1);
    const args = spawnMock.mock.calls[0][1] as string[];
    expect(args).not.toContain('-D');
    expect(args).not.toContain('-d');
  });

  it('does not pass a device flag when audioDeviceId is null', () => {
    const client = createClient(null);
    client.startTranscription();

    const args = spawnMock.mock.calls[0][1] as string[];
    expect(args).not.toContain('-D');
    expect(args).not.toContain('-d');
  });

  it('passes -D <id> and never -d when audioDeviceId is specified', () => {
    const DEVICE_ID = '{0.0.1.00000000}.{0966b276-c28c-4c1b-88eb-85519f7d7a4a}';
    const client = createClient(DEVICE_ID);
    client.startTranscription();

    const args = spawnMock.mock.calls[0][1] as string[];
    const dIndex = args.indexOf('-D');
    expect(dIndex).toBeGreaterThanOrEqual(0);
    expect(args[dIndex + 1]).toBe(DEVICE_ID);
    expect(args).not.toContain('-d');
  });

  it('spawns exactly once even if startTranscription is called multiple times', () => {
    const client = createClient('some-id');
    client.startTranscription();
    client.startTranscription();
    client.startTranscription();

    expect(spawnMock).toHaveBeenCalledTimes(1);
  });

  it('restarts the process when audioDeviceId changes while running', () => {
    const DEVICE_A = 'device-a';
    const DEVICE_B = 'device-b';
    const client = createClient(DEVICE_A);
    client.startTranscription();
    expect(spawnMock).toHaveBeenCalledTimes(1);
    const firstProcess = fakeProcesses[0];

    client.audioDeviceId = DEVICE_B;

    expect(firstProcess.killed).toBe(true);
    expect(spawnMock).toHaveBeenCalledTimes(2);
    const secondArgs = spawnMock.mock.calls[1][1] as string[];
    expect(secondArgs[secondArgs.indexOf('-D') + 1]).toBe(DEVICE_B);
  });

  it('does not spawn when audioDeviceId is set before the process is started', () => {
    const client = createClient(null);
    client.audioDeviceId = 'device-a';

    expect(spawnMock).not.toHaveBeenCalled();
    expect(client.audioDeviceId).toBe('device-a');
  });

  it('does not restart when the same audioDeviceId is assigned again', () => {
    const client = createClient('device-a');
    client.startTranscription();
    expect(spawnMock).toHaveBeenCalledTimes(1);

    client.audioDeviceId = 'device-a';

    expect(spawnMock).toHaveBeenCalledTimes(1);
  });
});
