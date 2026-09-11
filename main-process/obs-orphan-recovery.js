const fs = require('node:fs');

const PROCESS_EXIT_TIMEOUT_MS = 5000;
const NAIR_IPC_NAME_PATTERN = /^nair-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 通常起動時には外部プロセスを実行しないため、child_process は必要になった時だけ読み込む。
 */
function execFileAsync(file, args, options) {
  return new Promise((resolve, reject) => {
    require('node:child_process').execFile(file, args, options, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

/**
 * obs64.exe の起動引数から N Air が生成した IPC 名を取得する。
 *
 * @param {string} commandLine
 * @returns {string|undefined}
 */
function getNairIpcName(commandLine) {
  const match = commandLine.match(/(?:^|[\s"])(nair-[0-9a-f-]+)(?=[\s"]|$)/i);
  return match && NAIR_IPC_NAME_PATTERN.test(match[1]) ? match[1] : undefined;
}

/**
 * @returns {Promise<object[]|null>}
 */
async function getObsProcessMetadata() {
  try {
    const script = [
      '$processes = @(Get-CimInstance Win32_Process -Filter "Name = \'obs64.exe\'")',
      '@($processes | ForEach-Object {',
      '$process = $_;',
      '$parent = Get-CimInstance Win32_Process -Filter ("ProcessId = " + $process.ParentProcessId);',
      '[PSCustomObject]@{ Name = $process.Name; ProcessId = $process.ProcessId; ParentProcessId = $process.ParentProcessId; CreationDate = $process.CreationDate.ToUniversalTime().ToString("o"); ParentCreationDate = if ($parent) { $parent.CreationDate.ToUniversalTime().ToString("o") } else { $null }; ExecutablePath = $process.ExecutablePath; CommandLine = $process.CommandLine }',
      '}) | ConvertTo-Json -Compress',
    ].join('; ');
    const { stdout = '' } = await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', script],
      { windowsHide: true, timeout: 3000 },
    );
    const metadata = JSON.parse(stdout.trim() || '[]');
    return Array.isArray(metadata) ? metadata : [metadata];
  } catch {
    return null;
  }
}

/**
 * @param {{ Name?: string, ExecutablePath?: string }} metadata
 */
function isNairObsExecutable(metadata) {
  return (
    metadata.Name?.toLowerCase() === 'obs64.exe' &&
    /[\\/]node_modules[\\/]obs-studio-node[\\/]obs64\.exe$/i.test(metadata.ExecutablePath ?? '')
  );
}

/**
 * N Air 固有の IPC 名、同名パイプ、OBS 実行パス、親の不在がすべて一致する
 * obs64.exe だけを孤立した N Air OBS と判定する。
 */
async function findOrphanedNairObsProcesses() {
  let pipeNames;
  try {
    pipeNames = new Set(
      fs.readdirSync('\\\\.\\pipe\\', { encoding: 'utf8' })
        .filter((name) => NAIR_IPC_NAME_PATTERN.test(name))
        .map((name) => name.toLowerCase()),
    );
  } catch {
    return [];
  }

  // 通常起動時は N Air OBS の IPC パイプが存在しないため、
  // 時間のかかる PowerShell/CIM のプロセス照会を行わない。
  if (pipeNames.size === 0) return [];

  const processes = await getObsProcessMetadata();
  if (!processes) return [];
  return processes.filter((metadata) => {
    const ipcName = getNairIpcName(metadata.CommandLine ?? '');
    return (
      ipcName &&
      pipeNames.has(ipcName.toLowerCase()) &&
      isNairObsExecutable(metadata) &&
      !hasLiveParent(metadata)
    );
  });
}

/**
 * 親 PID が再利用されている場合は、親の生成時刻が OBS より新しくなる。
 * OBS より前から存在する親が現在も生きている場合だけ「所有者が生存中」と判断する。
 *
 * @param {{ CreationDate: string, ParentCreationDate?: string|null }} metadata
 */
function hasLiveParent(metadata) {
  if (!metadata.ParentCreationDate) return false;
  const creationTime = Date.parse(metadata.CreationDate);
  const parentCreationTime = Date.parse(metadata.ParentCreationDate);
  if (!Number.isFinite(creationTime) || !Number.isFinite(parentCreationTime)) return true;
  return parentCreationTime <= creationTime;
}

/**
 * @param {number} processId
 */
async function terminateProcess(processId) {
  await execFileAsync('taskkill.exe', ['/pid', String(processId), '/f'], { windowsHide: true });
}

/**
 * @param {number} processId
 */
async function waitForProcessExit(processId) {
  const deadline = Date.now() + PROCESS_EXIT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const processes = await getObsProcessMetadata();
    if (processes && !processes.some((metadata) => metadata.ProcessId === processId)) return true;
    await new Promise((resolve) => {
      setTimeout(resolve, 100);
    });
  }
  const processes = await getObsProcessMetadata();
  return processes !== null && !processes.some((metadata) => metadata.ProcessId === processId);
}

/**
 * N Air 固有 IPC とプロセス情報から特定した孤立 obs64.exe だけを終了する。
 * 判定不能時は一切プロセスを終了しない。
 *
 * @returns {Promise<{ recovered: boolean, reason: string, processId?: number }>}
 */
async function recoverOrphanedNairObsProcess() {
  const processes = await findOrphanedNairObsProcesses();
  if (processes.length === 0) return { recovered: false, reason: 'not-found' };
  const processIds = processes.map((metadata) => metadata.ProcessId);

  for (const processId of processIds) {
    try {
      await terminateProcess(processId);
    } catch {
      return { recovered: false, reason: 'termination-failed', processId };
    }
  }

  for (const processId of processIds) {
    if (!(await waitForProcessExit(processId))) {
      return { recovered: false, reason: 'exit-timeout', processId };
    }
  }

  return {
    recovered: true,
    reason: 'terminated',
    processId: processIds[0],
  };
}

module.exports = {
  findOrphanedNairObsProcesses,
  getNairIpcName,
  getObsProcessMetadata,
  hasLiveParent,
  isNairObsExecutable,
  recoverOrphanedNairObsProcess,
  terminateProcess,
  waitForProcessExit,
};
