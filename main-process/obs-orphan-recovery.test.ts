import {
  findOrphanedNairObsProcesses,
  getNairIpcName,
  hasLiveParent,
  isNairObsExecutable,
  recoverOrphanedNairObsProcess,
} from './obs-orphan-recovery';

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
    await expect(
      findOrphanedNairObsProcesses({
        getMetadata: jest.fn().mockResolvedValue([orphanMetadata]),
        getPipeNames: () => [ipcName],
      }),
    ).resolves.toEqual([orphanMetadata]);
  });

  test('N Air IPCパイプがないときプロセス情報を取得しない', async () => {
    const getMetadata = jest.fn();

    await expect(
      findOrphanedNairObsProcesses({
        getMetadata,
        getPipeNames: () => ['NAirSubstream', 'unrelated-pipe'],
      }),
    ).resolves.toEqual([]);
    expect(getMetadata).not.toHaveBeenCalled();
  });

  test.each([
    ['同名パイプがない', orphanMetadata, []],
    [
      '親が生存している',
      { ...orphanMetadata, ParentCreationDate: '2026-08-20T10:00:00.000Z' },
      [ipcName],
    ],
    [
      'N Air以外のOBSパスである',
      {
        ...orphanMetadata,
        ExecutablePath: 'C:\\Program Files\\obs-studio\\bin\\64bit\\obs64.exe',
      },
      [ipcName],
    ],
  ])('%sとき候補にしない', async (_name, metadata, pipeNames) => {
    await expect(
      findOrphanedNairObsProcesses({
        getMetadata: jest.fn().mockResolvedValue([metadata]),
        getPipeNames: () => pipeNames,
      }),
    ).resolves.toEqual([]);
  });
});

describe('recoverOrphanedNairObsProcess', () => {
  test('安全に特定した孤立obs64.exeだけを終了する', async () => {
    const terminate = jest.fn().mockResolvedValue(undefined);
    const waitForExit = jest.fn().mockResolvedValue(true);

    await expect(
      recoverOrphanedNairObsProcess({
        findProcesses: jest.fn().mockResolvedValue([orphanMetadata]),
        terminate,
        waitForExit,
      }),
    ).resolves.toEqual({ recovered: true, reason: 'terminated', processId: 1234 });
    expect(terminate).toHaveBeenCalledWith(1234);
  });

  test('候補を確認できないとき何も終了しない', async () => {
    const terminate = jest.fn();

    await expect(
      recoverOrphanedNairObsProcess({
        findProcesses: jest.fn().mockResolvedValue([]),
        terminate,
      }),
    ).resolves.toEqual({ recovered: false, reason: 'not-found' });
    expect(terminate).not.toHaveBeenCalled();
  });
});
