import { PrepareFunc } from 'util/QueueRunner';
import { SentryReport } from 'util/sentry-report';

import { Speech } from '../nicolive-comment-synthesizer';

import { ISpeechSynthesizer } from './ISpeechSynthesizer';

export interface INVoiceTalker {
  talk(
    text: string,
    options: {
      speed: number;
      volume: number;
      maxTime: number;
      phonemeCallback?: (phoneme: string) => void;
    },
  ): Promise<
    () => Promise<{
      cancel: () => void;
      pause: () => void;
      resume: () => void;
      speaking: Promise<void>;
    } | null>
  >;
}

export class NVoiceSynthesizer implements ISpeechSynthesizer {
  constructor(private nVoiceTalker: INVoiceTalker) {}

  speakText(
    speech: Speech,
    onstart: () => void,
    onend: () => void,
    onPhoneme?: (phoneme: string) => void,
  ): PrepareFunc {
    return async () => {
      try {
        const start = await this.nVoiceTalker.talk(speech.text, {
          speed: 1 / (speech.rate || 1),
          volume: speech.volume,
          maxTime: speech.nVoice?.maxTime,
          phonemeCallback: (phoneme: string) => {
            if (onPhoneme) {
              onPhoneme(phoneme);
            }
          },
        });
        if (!start) {
          return null;
        }
        return async () => {
          const r = await start();
          if (r === null) {
            // no sound
            return null;
          }
          (async () => {
            onstart();
            await r.speaking;
            onend();
          })();
          return {
            cancel: async () => {
              r.cancel();
              await r.speaking;
            },
            pause: () => {
              r.pause();
            },
            resume: () => {
              r.resume();
            },
            running: r.speaking,
          };
        };
      } catch (error) {
        SentryReport.error('NVoiceSynthesizer', 'speakText', error, {
          tags: { in: 'NVoiceSynthesizer:speakText' },
          extra: { speech, error },
          fingerprint: ['NVoiceSynthesizer', 'speakText', 'error'],
        });
        console.info(`NVoiceSynthesizer: text:${JSON.stringify(speech.text)} -> ${error}`);
      }
    };
  }
}
