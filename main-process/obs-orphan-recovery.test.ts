import {
  findOrphanedNairObsProcesses,
  getNairIpcName,
  hasLiveParent,
  isNairObsExecutable,
  recoverOrphanedNairObsProcess,
} from './obs-orphan-recovery';

jest.mock('node:fs', () => ({ readdirSync: jest.fn() }));
jest.mock('node:child_process', () => ({ execFile: jest.fn() }));

const mockReaddirSync = jest.requireMock('node:fs').readdirSync as jest.Mock;
const mockExecFile = jest.requireMock('node:child_process').execFile as jest.Mock;

const ipcName = 'nair-6e6318df-3236-41b8-a1c1-4037fc05f589';
const orphanMetadata = {
  Name: 'obs64.exe',
  ProcessId: 1234,
  ParentProcessId: 1000,
  CreationDate: '2026-08-20T10:00:01.000Z',
  ParentCreationDate: null,
  ExecutablePath: 'C:\\Program Files\\N Air\\resources\\node_modules\\obs-studio-node\\obs64.exe',
  CommandLine: `"C:\\Program Files\\N Air\\resources\\node_modules\\obs-studio-node\\obs64.exe" ${ipcName} DEVMODE_VERSION`,
};

function mockExecResults(...results: object[][]) {
  mockExecFile.mockImplementation((...args: any[]) => {
    const callback = args.at(-1) as (error: Error | null, stdout: string, stderr: string) => void;
    callback(null, JSON.stringify(results.shift() ?? []), '');
    return {};
  });
  return mockExecFile;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockReaddirSync.mockReset();
  mockExecFile.mockReset();
});

describe('N Air OBSの識別', () => {
  test('コマンドラインから正しいN Air IPC名を取得する', () => {
    expect(getNairIpcName(orphanMetadata.CommandLine)).toBe(ipcName);
    expect(getNairIpcName('obs64.exe unrelated-name')).toBeUndefined();
  });

  test('obs-studio-node配下のobs64.exeだけを認める', () => {
    expect(isNairObsExecutable(orphanMetadata)).toBe(true);
    expect(
      isNairObsExecutable({
        Name: 'obs64.exe',
        ExecutablePath: 'C:\\Program Files\\obs-studio\\bin\\64bit\\obs64.exe',
      }),
    ).toBe(false);
  });

  test('OBSより前に生成された親が存在するとき生存中と判断する', () => {
    expect(
      hasLiveParent({
        CreationDate: '2026-08-20T10:00:01.000Z',
        ParentCreationDate: '2026-08-20T10:00:00.000Z',
      }),
    ).toBe(true);
  });

  test('親PIDが再利用されて親の方が新しいとき孤立と判断する', () => {
    expect(
      hasLiveParent({
        CreationDate: '2026-08-20T10:00:00.000Z',
        ParentCreationDate: '2026-08-20T10:01:00.000Z',
      }),
    ).toBe(false);
  });

  test('IPC名・同名パイプ・実行パス・親不在が一致するプロセスを返す', async () => {
    mockReaddirSync.mockReturnValue([ipcName]);
    mockExecResults([orphanMetadata]);

    await expect(findOrphanedNairObsProcesses()).resolves.toEqual([orphanMetadata]);
  });

  test('N Air IPCパイプがないときPowerShellを実行しない', async () => {
    mockReaddirSync.mockReturnValue(['NAirSubstream', 'unrelated-pipe']);

    await expect(findOrphanedNairObsProcesses()).resolves.toEqual([]);
    expect(mockExecFile).not.toHaveBeenCalled();
  });

  test.each([
    [
      '親が生存している',
      { ...orphanMetadata, ParentCreationDate: '2026-08-20T10:00:00.000Z' },
    ],
    [
      'N Air以外のOBSパスである',
      {
        ...orphanMetadata,
        ExecutablePath: 'C:\\Program Files\\obs-studio\\bin\\64bit\\obs64.exe',
      },
    ],
    [
      'コマンドラインのIPC名とパイプ名が異なる',
      {
        ...orphanMetadata,
        CommandLine:
          '"C:\\Program Files\\N Air\\resources\\node_modules\\obs-studio-node\\obs64.exe" nair-00000000-0000-0000-0000-000000000000 DEVMODE_VERSION',
      },
    ],
  ])('%sとき候補にしない', async (_name, metadata) => {
    mockReaddirSync.mockReturnValue([ipcName]);
    mockExecResults([metadata]);

    await expect(findOrphanedNairObsProcesses()).resolves.toEqual([]);
  });
});

describe('recoverOrphanedNairObsProcess', () => {
  test('安全に特定した孤立obs64.exeだけを終了する', async () => {
    mockReaddirSync.mockReturnValue([ipcName]);
    const execFile = mockExecResults([orphanMetadata], []);

    await expect(recoverOrphanedNairObsProcess()).resolves.toEqual({
      recovered: true,
      reason: 'terminated',
      processId: 1234,
    });
    expect(execFile).toHaveBeenNthCalledWith(
      2,
      'taskkill.exe',
      ['/pid', '1234', '/f'],
      { windowsHide: true },
      expect.any(Function),
    );
  });

  test('候補を確認できないとき何も終了しない', async () => {
    mockReaddirSync.mockReturnValue([]);

    await expect(recoverOrphanedNairObsProcess()).resolves.toEqual({
      recovered: false,
      reason: 'not-found',
    });
    expect(mockExecFile).not.toHaveBeenCalled();
  });
});
