// N Voice Client Service

import * as remote from '@electron/remote';
import * as Sentry from '@sentry/vue';
import { join } from 'path';
import { StatefulService } from 'services/core/stateful-service';
import { sleep } from 'util/sleep';
import { getNVoicePath, NVoiceClient } from './speech/NVoiceClient';
import { INVoiceTalker } from './speech/NVoiceSynthesizer';

/** play audio from Buffer as wave file.
 * @return .cancel function to stop playing.
 * @return .done promise to wait until playing is completed.
 */
async function playAudio(
  buffer: Buffer,
  volume: number = 1.0,
): Promise<{ cancel: () => void; pause: () => void; resume: () => void; done: Promise<void> }> {
  const url = URL.createObjectURL(new Blob([new Uint8Array(buffer)]));
  let cancel: () => void;
  let pause: () => void;
  let resume: () => void;

  let completed = false;
  const done = new Promise<void>((resolve, reject) => {
    const audio = new Audio(url);
    audio.volume = volume;
    audio.addEventListener('error', () => {
      reject(audio.error);
    });
    audio.addEventListener('ended', () => {
      resolve();
    });
    const playPromise = audio.play();
    pause = () => {
      if (!completed) {
        playPromise
          .then(() => {
            if (!audio.paused) {
              audio.pause();
            }
          })
          .catch(err => {
            Sentry.withScope(scope => {
              scope.setLevel('error');
              scope.setTag('in', 'playAudio:pause');
              Sentry.captureException(err);
            });
          });
      }
    };
    resume = () => {
      if (!completed) {
        playPromise
          .then(() => {
            if (audio.paused) {
              audio.play();
            }
          })
          .catch(err => {
            Sentry.withScope(scope => {
              scope.setLevel('error');
              scope.setTag('in', 'playAudio:resume');
              Sentry.captureException(err);
            });
          });
      }
    };
    cancel = () => {
      if (!completed) {
        playPromise
          .then(() => {
            audio.pause();
          })
          .catch(err => {
            Sentry.withScope(scope => {
              scope.setLevel('error');
              scope.setTag('in', 'playAudio:cancel');
              Sentry.captureException(err);
            });
          })
          .finally(() => {
            resolve();
          });
      }
    };
  }).finally(() => {
    completed = true;
    URL.revokeObjectURL(url);
  });
  return {
    cancel,
    pause,
    resume,
    done,
  };
}

interface INVoiceClientState {
  enabled: boolean;
}

async function showError(err: Error): Promise<void> {
  await remote.dialog.showMessageBox(remote.getCurrentWindow(), {
    type: 'error',
    message: err.toString(),
    buttons: ['close'],
  });
}

export class NVoiceClientService
  extends StatefulService<INVoiceClientState>
  implements INVoiceTalker {
  static initialState: INVoiceClientState = {
    enabled: true,
  };

  private client: NVoiceClient;

  init(): void {
    this.client = new NVoiceClient({ baseDir: getNVoicePath(), onError: showError });
  }

  async prefetch(): Promise<void> {
    try {
      await this.client.startNVoice();
    } catch (e) {
      console.warn('NVoice prefetch failed:', e);
    }
  }

  private index = 0;
  private speaking: Promise<void> | undefined;

  async talk(
    text: string,
    options: {
      speed: number;
      volume: number;
      maxTime: number;
      phonemeCallback?: (phoneme: string) => void;
    },
  ): Promise<
    | null
    | (() => Promise<{
      cancel: () => void;
      pause: () => void;
      resume: () => void;
      speaking: Promise<void>;
    } | null>)
  > {
    const client = this.client;
    const tempDir = remote.app.getPath('temp');
    const wavFileName = join(tempDir, `n-voice-talk-${this.index}.wav`);
    this.index++;
    await client.set_max_time(options.maxTime);
    const { wave, labels } = await client.talk(options.speed, text, wavFileName);
    if (!wave) {
      // なにも発音しないときは無視
      return null;
    }

    return async () => {
      if (this.speaking) {
        await this.speaking;
      }

      const startTime = Date.now();
      let checkPointTime = startTime;
      let checkPointOffset = 0;
      let paused: Promise<void> | null = null;
      let resolvePaused: () => void = null;
      const { cancel, pause, resume, done } = await playAudio(wave, options.volume);
      let phonemeCancel = false;
      if (options.phonemeCallback) {
        const phonemeLoop = async () => {
          for (const label of labels) {
            if (paused) {
              await paused;
              if (phonemeCancel) {
                break;
              }
            }
            const elapsed = Date.now() - checkPointTime + checkPointOffset;
            const next = label.start * 1000;
            if (next > elapsed) {
              await sleep(next - elapsed);
              if (phonemeCancel) {
                break;
              }
            }
            options.phonemeCallback(label.phoneme);
          }
          options.phonemeCallback(''); // done
        };
        phonemeLoop();
      }
      this.speaking = done;
      return {
        cancel: () => {
          phonemeCancel = true;
          if (resolvePaused) {
            resolvePaused();
          }
          cancel();
        },
        pause: () => {
          if (!paused) {
            const now = Date.now();
            checkPointOffset += now - checkPointTime;
            paused = new Promise(resolve => {
              resolvePaused = resolve;
            });
            pause();
          }
        },
        resume: () => {
          if (resolvePaused) {
            resolvePaused();
            resolvePaused = null;
            paused = null;
            checkPointTime = Date.now();
          }
          resume();
        },
        speaking: done,
      };
    };
  }
}
