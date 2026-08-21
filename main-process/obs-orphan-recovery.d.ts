export interface ProcessMetadata {
  Name: string;
  ProcessId: number;
  ParentProcessId: number;
  CreationDate: string;
  ParentCreationDate?: string | null;
  ExecutablePath: string;
  CommandLine: string;
}

export interface RecoveryResult {
  recovered: boolean;
  reason: string;
  processId?: number;
}

export function getNairIpcName(commandLine: string): string | undefined;
export function getObsProcessMetadata(): Promise<ProcessMetadata[]>;
export function isNairObsExecutable(
  metadata: Pick<ProcessMetadata, 'Name' | 'ExecutablePath'>,
): boolean;
export function findOrphanedNairObsProcesses(): Promise<ProcessMetadata[]>;
export function hasLiveParent(
  metadata: Pick<ProcessMetadata, 'CreationDate' | 'ParentCreationDate'>,
): boolean;
export function terminateProcess(processId: number): Promise<void>;
export function waitForProcessExit(
  processId: number,
): Promise<boolean>;
export function recoverOrphanedNairObsProcess(): Promise<RecoveryResult>;
