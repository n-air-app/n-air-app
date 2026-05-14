// vosk-cli のクライアント

import { ChildProcess, spawn, spawnSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';

import { Observable, Subject } from 'rxjs';
import { CommandLineClient } from 'services/nicolive-program/speech/NVoiceClient';

export function getVoskCliPath(): string {
  // import/require構文を使うとビルド時に展開してしまうが、
  // バイナリファイルを実行時に参照するために実行時のrequireでロードする必要がある
  const nVoicePath = window['require']('vosk-cli')
    .getExePath()
    .replace('app.asar', 'app.asar.unpacked'); // ビルドしたpackageでは展開パスは置換する必要がある
  return nVoicePath;
}

export type AudioDeviceInfo = {
  index: number;
  id: string;
  name: string;
};

export type AudioDeviceList = {
  devices: AudioDeviceInfo[];
  version: string; // vosk-cli version
};

type VoskCliMessage =
  | {
      info: string; // Information message: 'start'
    }
  | {
      partial: string; // Partial transcription result: 'partial text'
    }
  | {
      text: string; // Final transcription result: 'final text'
    }
  | {
      format: {};
    }
  | { error: string };

export type TranscriptionMessage =
  | VoskCliMessage
  | {
      processExited: string; // Process exited with code: 'code'
    };

export interface ITranscriber {
  audioDeviceIndex: number;
  startTranscription(): Observable<TranscriptionMessage>;
  stopTranscription(): void;
}

function isAudioDeviceList(obj: any): obj is AudioDeviceList {
  return (
    obj
    && Array.isArray(obj.devices)
    && obj.devices.every(
      (device: any) =>
        typeof device.index === 'number'
        && typeof device.id === 'string'
        && typeof device.name === 'string',
    )
    && typeof obj.version === 'string'
  );
}

export function isInfoTranscriptionMessage(obj: TranscriptionMessage): obj is { info: string } {
  return 'info' in obj && typeof obj.info === 'string';
}

export function isFormatTranscriptionMessage(
  obj: TranscriptionMessage,
): obj is { format: Record<string, unknown> } {
  return 'format' in obj && typeof obj.format === 'object' && Object.keys(obj.format).length > 0;
}

export function isTextTranscriptionMessage(obj: TranscriptionMessage): obj is { text: string } {
  return 'text' in obj && typeof obj.text === 'string';
}

export function isPartialTranscriptionMessage(
  obj: TranscriptionMessage,
): obj is { partial: string } {
  return 'partial' in obj && typeof obj.partial === 'string';
}

export function isErrorTranscriptionMessage(obj: TranscriptionMessage): obj is { error: string } {
  return 'error' in obj && typeof obj.error === 'string';
}

export function isProcessExitedMessage(
  obj: TranscriptionMessage,
): obj is { processExited: string } {
  return 'processExited' in obj && typeof obj.processExited === 'string';
}

function isVoskCliMessage(obj: any): obj is TranscriptionMessage {
  return (
    obj
    && (isInfoTranscriptionMessage(obj)
      || isPartialTranscriptionMessage(obj)
      || isTextTranscriptionMessage(obj)
      || isErrorTranscriptionMessage(obj)
      || isFormatTranscriptionMessage(obj))
  );
}

function isTranscriptionMessage(obj: any): obj is TranscriptionMessage {
  return obj && (isVoskCliMessage(obj) || isProcessExitedMessage(obj));
}

// Transcriber implementation using vosk-cli
export class VoskClient implements ITranscriber {
  private _voskCliPath: string;
  private _modelPath: string;
  private _audioDeviceIndex: number = 0;
  private _voskCliProcess: ChildProcess | null = null;
  private transcribe$: Subject<TranscriptionMessage> | null = null;

  constructor(options: { voskCliPath: string; modelPath: string }) {
    // validate options
    if (!options.voskCliPath) {
      throw new Error('voskCliPath is required');
    }
    if (!options.modelPath) {
      throw new Error('modelPath is required');
    }
    if (!existsSync(options.voskCliPath)) {
      throw new Error(`voskCliPath does not exist: ${options.voskCliPath}`);
    }
    // Check if modelPath exists and is a directory
    const modelStat = statSync(options.modelPath);
    if (!modelStat.isDirectory()) {
      throw new Error(`modelPath must be a directory: ${options.modelPath}`);
    }
    this._voskCliPath = options.voskCliPath;
    this._modelPath = options.modelPath;
    this.transcribe$ = new Subject<TranscriptionMessage>();
  }

  static listAudioDevices(voskCliPath: string): AudioDeviceList {
    const result = spawnSync(voskCliPath, ['-l']);
    if (result.error) {
      console.error(`Failed to list audio devices: ${result.error.message}`);
      return { devices: [], version: '' };
    }
    const output = result.stdout.toString();
    const parsed = JSON.parse(output);
    if (!isAudioDeviceList(parsed)) {
      console.error(`Invalid audio device list format: ${output}`);
      return { devices: [], version: '' };
    }
    return parsed;
  }

  activateVoskCliProcess(): void {
    if (this._voskCliProcess && !this._voskCliProcess.killed) {
      console.warn('activateVoskCliProcess: Vosk CLI process is already running.');
      return; // Process is already running
    }
    const args = ['-m', this._modelPath];
    if (this._audioDeviceIndex !== null) {
      args.push('-d', this._audioDeviceIndex.toString());
    }
    this._voskCliProcess = spawn(this._voskCliPath, args, {
      stdio: 'pipe',
    });
    this._voskCliProcess.on('error', (err) => {
      console.error(`vosk-cli process error: ${err.message}`);
      this.transcribe$?.next({ processExited: `Launch error: ${err.message}` });
      this.transcribe$?.next({ info: `Error: ${err.message}` });
    });
    this._voskCliProcess.on('exit', (code, signal) => {
      console.log(`vosk-cli process exited with code: ${code}, signal: ${signal}`);
      this.transcribe$?.next({ processExited: `code:${code}, signal:${signal}` });
      this.shutdownVoskCliProcess();
    });
    let stdoutBuffer = '';
    let stderrBuffer = '';
    this._voskCliProcess.stdout.on('data', (data) => {
      stdoutBuffer += data.toString();
      const lines = stdoutBuffer.split('\n');
      stdoutBuffer = lines.pop() || ''; // Keep the last incomplete line
      for (const line of lines) {
        if (line.trim()) {
          try {
            const message: VoskCliMessage = JSON.parse(line.trim());
            if (isVoskCliMessage(message)) {
              this.transcribe$?.next(message);
            } else {
              console.warn(`Invalid message format: ${line}`);
            }
          } catch (e) {
            console.error(`Failed to parse message: ${line}`, e);
            this.transcribe$?.next({ info: `Error parsing message: ${JSON.stringify(line)}` });
          }
        }
      }
    });
    this._voskCliProcess.stderr.on('data', (data) => {
      stderrBuffer += data.toString();
      const lines = stderrBuffer.split('\n');
      stderrBuffer = lines.pop() || ''; // Keep the last incomplete line
      for (const line of lines) {
        if (line.trim()) {
          console.error(`Vosk CLI process error: ${line}`);
          this.transcribe$?.next({ info: `Error: ${line}` });
        }
      }
    });
  }

  shutdownVoskCliProcess(): void {
    if (this._voskCliProcess) {
      this._voskCliProcess.kill();
      this._voskCliProcess.removeAllListeners();
      this._voskCliProcess = null;
    }
  }

  set audioDeviceIndex(index: number) {
    if (this._audioDeviceIndex === index) {
      return; // No change needed
    }
    this._audioDeviceIndex = index;
    this.shutdownVoskCliProcess(); // Restart the process with the new device
    this.activateVoskCliProcess();
  }
  get audioDeviceIndex(): number {
    return this._audioDeviceIndex;
  }

  startTranscription(): Observable<TranscriptionMessage> {
    if (!this._voskCliProcess || this._voskCliProcess.killed) {
      this.activateVoskCliProcess();

      const client = new CommandLineClient(
        this._voskCliProcess,
        (...args: unknown[]) => {
          console.log(...args);
        },
        true,
      );
      client.waitLine((line: string) => {
        try {
          const message: TranscriptionMessage = JSON.parse(line);
          if (isTranscriptionMessage(message)) {
            this.transcribe$?.next(message);
          } else {
            console.warn(`Invalid message format: ${line}`);
          }
        } catch (e) {
          console.error(`Failed to parse message: ${line}`, e);
          this.transcribe$?.next({ info: `Error parsing message: ${JSON.stringify(line)}` });
        }
        return false; // Continue listening for more lines
      });
    }

    return this.transcribe$.asObservable();
  }

  async stopTranscription() {
    this.shutdownVoskCliProcess();
  }
}

export function CreateVoskCliClient(options: {
  voskCliPath: string;
  modelPath: string;
}): ITranscriber {
  const { voskCliPath, modelPath } = options;

  return new VoskClient({
    voskCliPath,
    modelPath,
  });
}
