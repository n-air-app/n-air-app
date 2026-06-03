import * as Sentry from '@sentry/vue';

import { Speech } from '../nicolive-comment-synthesizer';

import { VoicevoxSynthesizer } from './VoicevoxSynthesizer';

jest.mock('@sentry/vue', () => ({
  withScope: jest.fn((fn: (scope: any) => void) =>
    fn({
      setLevel: jest.fn(),
      setTag: jest.fn(),
      setExtra: jest.fn(),
      setFingerprint: jest.fn(),
    }),
  ),
  captureException: jest.fn(),
}));

const makeSpeech = (): Speech => ({
  text: 'テスト',
  synthesizer: 'voicevox',
  rate: 1.0,
  voicevox: { id: '1', name: 'ずんだもん' },
});

describe('VoicevoxSynthesizer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('speakText', () => {
    it('VOICEVOX 未起動 (Failed to fetch) の場合、Sentry に送らず console.warn のみ', async () => {
      const synth = new VoicevoxSynthesizer();
      jest.spyOn(synth, 'output').mockRejectedValue(new TypeError('Failed to fetch'));
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const speech = makeSpeech();
      const outer = synth.speakText(speech, jest.fn(), jest.fn());
      const inner = await outer();
      const result = await inner!();
      if (result) await result.running;

      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0][0]).toContain('[VoicevoxSynthesizer]');
      expect(Sentry.captureException).not.toHaveBeenCalled();
    });

    it('その他のエラーは Sentry.captureException を呼ぶ', async () => {
      const synth = new VoicevoxSynthesizer();
      jest.spyOn(synth, 'output').mockRejectedValue(new Error('unexpected error'));
      jest.spyOn(console, 'info').mockImplementation(() => {});

      const speech = makeSpeech();
      const outer = synth.speakText(speech, jest.fn(), jest.fn());
      const inner = await outer();
      const result = await inner!();
      if (result) await result.running;

      expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    });
  });
});
