import Utils from 'services/utils';
import { Speech } from '../nicolive-comment-synthesizer';
import { ISpeechSynthesizer } from './ISpeechSynthesizer';
import * as Sentry from '@sentry/vue';

export class WebSpeechSynthesizer implements ISpeechSynthesizer {
  get available(): boolean {
    return window.speechSynthesis !== undefined;
  }

  private speakingPromise: Promise<void> | null = null;
  private speakingResolve: () => void | null = null;
  private speakingCounter: number = 0;

  speakText(speech: Speech, onstart: () => void, onend: () => void) {
    return async () => async () => {
      if (!speech || speech.text === '' || !this.available) {
        return null;
      }
      if (!this.speakingPromise) {
        this.speakingPromise = new Promise(resolve => {
          this.speakingResolve = resolve;
        });
      }

      const uttr = new SpeechSynthesisUtterance(speech.text);
      uttr.pitch = speech.webSpeech?.pitch || 1; // tone
      uttr.rate = speech.rate || 1; // speed
      uttr.volume = speech.volume || 1;
      uttr.onstart = onstart;
      uttr.onend = () => {
        if (--this.speakingCounter === 0) {
          this.speakingResolve();
          this.speakingPromise = null;
          this.speakingResolve = null;
        }
        onend();
      };
      uttr.onerror = e => {
        Sentry.captureEvent({
          message: 'speechSynthesis.onerror',
          level: ['interrupted', 'canceled'].includes(e.error) ? 'info' : 'warning',
          tags: {
            error: e.error,
          },
          extra: {
            speech,
          },
        });
        if (Utils.isDevMode()) {
          console.warn('speechSynthesis.onerror', e.error);
        }
        if (--this.speakingCounter === 0) {
          this.speakingResolve();
          this.speakingPromise = null;
          this.speakingResolve = null;
        }
        onend();
      };
      speechSynthesis.speak(uttr);
      this.speakingCounter++;
      return {
        cancel: async () => {
          speechSynthesis.cancel();
        },
        running: this.speakingPromise,
      };
    };
  }
}
