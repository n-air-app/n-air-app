// stt_cli のクライアント

import { ChildProcess, spawn, spawnSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { Observable, Subject } from 'rxjs';
import { CommandLineClient } from 'services/nicolive-program/speech/NVoiceClient';

export type AudioDeviceInfo = {
  index: number;
  id: string;
  name: string;
};

export type AudioDeviceList = {
  devices: AudioDeviceInfo[];
  version: string; // stt_cli version
};

export type TranscriptionMessage =
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
    };

export interface ITranscriber {
  audioDevices(): AudioDeviceList;
  audioDeviceIndex: number | null; // null if not set
  startTranscription(): Observable<TranscriptionMessage>;
  stopTranscription(): void;
}

function isAudioDeviceList(obj: any): obj is AudioDeviceList {
  return (
    obj &&
    Array.isArray(obj.devices) &&
    obj.devices.every(
      (device: any) =>
        typeof device.index === 'number' &&
        typeof device.id === 'string' &&
        typeof device.name === 'string',
    ) &&
    typeof obj.version === 'string'
  );
}

function isTranscriptionMessage(obj: any): obj is TranscriptionMessage {
  return (
    obj &&
    (typeof obj.info === 'string' ||
      typeof obj.partial === 'string' ||
      typeof obj.text === 'string' ||
      (obj.format && typeof obj.format === 'object' && Object.keys(obj.format).length > 0))
  );
}

export function isTextTranscriptionMessage(obj: TranscriptionMessage): obj is { text: string } {
  return 'text' in obj && typeof obj.text === 'string';
}

export function isPartialTranscriptionMessage(
  obj: TranscriptionMessage,
): obj is { partial: string } {
  return 'partial' in obj && typeof obj.partial === 'string';
}

// Transcriber implementation using stt_cli
export class SttClient implements ITranscriber {
  private _sttCliPath: string;
  private _modelPath: string;
  private _audioDeviceIndex: number | null = null;
  private _audioDeviceList: AudioDeviceList;
  private _sttProcess: ChildProcess | null = null;
  private transcribe$: Subject<TranscriptionMessage> | null = null;

  constructor(options: { sttCliPath: string; modelPath: string }) {
    // validate options
    if (!options.sttCliPath || !options.modelPath) {
      throw new Error('sttCliPath and modelPath are required');
    }
    if (!existsSync(options.sttCliPath)) {
      throw new Error(`sttCliPath does not exist: ${options.sttCliPath}`);
    }
    // Check if modelPath exists and is a directory
    const modelStat = statSync(options.modelPath);
    if (!modelStat.isDirectory()) {
      throw new Error(`modelPath must be a directory: ${options.modelPath}`);
    }
    this._sttCliPath = options.sttCliPath;
    this._modelPath = options.modelPath;
    this.transcribe$ = new Subject<TranscriptionMessage>();
    this._audioDeviceList = SttClient.listAudioDevices(this._sttCliPath);
  }

  static listAudioDevices(sttCliPath: string): AudioDeviceList {
    const result = spawnSync(sttCliPath, ['-l']);
    if (result.error) {
      throw new Error(`Failed to list audio devices: ${result.error.message}`);
    }
    const output = result.stdout.toString();
    const parsed = JSON.parse(output);
    if (!isAudioDeviceList(parsed)) {
      throw new Error(`Invalid audio device list format: ${output}`);
    }
    return parsed;
  }

  audioDevices(): AudioDeviceList {
    return this._audioDeviceList;
  }

  activateSttProcess(): void {
    if (this._sttProcess && !this._sttProcess.killed) {
      return; // Process is already running
    }
    const args = ['-m', this._modelPath];
    if (this._audioDeviceIndex !== null) {
      args.push('-d', this._audioDeviceIndex.toString());
    }
    this._sttProcess = spawn(this._sttCliPath, args, {
      stdio: 'pipe',
    });
    this._sttProcess.on('error', err => {
      console.error(`STT process error: ${err.message}`);
      this.transcribe$?.next({ info: `Error: ${err.message}` });
    });
    this._sttProcess.on('exit', code => {
      console.log(`STT process exited with code: ${code}`);
      this.transcribe$?.next({ info: `Process exited with code: ${code}` });
      this.shutdownSttProcess();
    });
    let stdoutBuffer = '';
    let stderrBuffer = '';
    this._sttProcess.stdout.on('data', data => {
      stdoutBuffer += data.toString();
      const lines = stdoutBuffer.split('\n');
      stdoutBuffer = lines.pop() || ''; // Keep the last incomplete line
      for (const line of lines) {
        if (line.trim()) {
          try {
            const message: TranscriptionMessage = JSON.parse(line.trim());
            if (isTranscriptionMessage(message)) {
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
    this._sttProcess.stderr.on('data', data => {
      stderrBuffer += data.toString();
      const lines = stderrBuffer.split('\n');
      stderrBuffer = lines.pop() || ''; // Keep the last incomplete line
      for (const line of lines) {
        if (line.trim()) {
          console.error(`STT process error: ${line}`);
          this.transcribe$?.next({ info: `Error: ${line}` });
        }
      }
    });
  }

  shutdownSttProcess(): void {
    if (this._sttProcess) {
      console.log('Shutting down STT process...'); // DEBUG
      this._sttProcess.kill();
      this._sttProcess = null;
    }
  }

  set audioDeviceIndex(index: number) {
    if (index < 0 || index >= this._audioDeviceList.devices.length) {
      throw new Error('Invalid audio device index');
    }
    if (this._audioDeviceIndex === index) {
      return; // No change needed
    }
    this._audioDeviceIndex = index;
    this.shutdownSttProcess(); // Restart the process with the new device
    this.activateSttProcess();
  }
  get audioDeviceIndex(): number | null {
    return this._audioDeviceIndex;
  }

  startTranscription(): Observable<TranscriptionMessage> {
    if (!this._sttProcess || this._sttProcess.killed) {
      this.activateSttProcess();

      const client = new CommandLineClient(
        this._sttProcess,
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
    this.shutdownSttProcess();
  }
}

export function CreateSttClient(options: { sttCliPath: string; modelPath: string }): ITranscriber {
  const { sttCliPath, modelPath } = options;

  return new SttClient({
    sttCliPath,
    modelPath,
  });
}
