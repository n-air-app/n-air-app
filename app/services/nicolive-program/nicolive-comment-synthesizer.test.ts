import { BehaviorSubject, Subject } from 'rxjs';
import { QueueRunner, QueueRunnerState } from 'util/QueueRunner';
import { createSetupFunction } from 'util/test-setup';

import type { ICommentSynthesizerState, Speech } from './nicolive-comment-synthesizer';
import { isWrappedChat, WrappedChat, WrappedMessage } from './WrappedChat';

type NicoliveCommentSynthesizerService =
  import('./nicolive-comment-synthesizer').NicoliveCommentSynthesizerService;

const setup = createSetupFunction({
  injectee: {
    NicoliveProgramStateService: {
      updated: {
        subscribe() {},
      },
      state: {},
      updateSpeechSynthesizerSettings() {},
    },
    NVoiceClientService: {},
    NVoiceCharacterService: {
      updateSocketIoPort: jest.fn(),
    },
    UserService: {
      platform: {
        id: '<platform_id>',
      },
    },
    SoundDetectorService: {
      soundDetectedSubject: new Subject(),
    },
  },
});

jest.mock('services/nicolive-program/state', () => ({ NicoliveProgramStateService: {} }));
jest.mock('services/nicolive-program/n-voice-client', () => ({ NVoiceClientService: {} }));
jest.mock('services/nvoice-character', () => ({ NVoiceCharacterService: {} }));
jest.mock('services/user', () => ({ UserService: {} }));

beforeEach(() => {
  jest.doMock('services/core/stateful-service');
  jest.doMock('services/core/injector');
  jest.doMock('util/QueueRunner', () => ({
    QueueRunner: jest.fn().mockImplementation(() => {
      const mockState: QueueRunnerState = {
        length: 0,
        state: null,
        disabled: false,
        nextLabel: null,
      };
      const stateSubject = new BehaviorSubject(mockState);
      return {
        state$: stateSubject.asObservable(),
        add: jest.fn(),
        cancel: jest.fn().mockResolvedValue(undefined),
        cancelQueue: jest.fn(),
        runNext: jest.fn(),
        enable: jest.fn(),
        disable: jest.fn().mockResolvedValue(undefined),
        get length() { return mockState.length; },
        get state() { return mockState.state; },
        get disabled() { return mockState.disabled; },
        isRunning: false,
        waitUntilFinished: jest.fn().mockResolvedValue(undefined),
      };
    }),
  }));
  jest.doMock('./speech/NVoiceSynthesizer');
  jest.doMock('./speech/WebSpeechSynthesizer');
});

afterEach(() => {
  jest.resetModules();
});

const testPitch = 0.2;
const testRate = 0.4;
const testVolume = 0.6;
const testMaxTime = 4;

const mockedState: ICommentSynthesizerState = {
  enabled: true,
  soundDetectorEnabled: false,
  queueRunnerState: null,
  rate: testRate,
  pitch: testPitch,
  maxTime: testMaxTime,
  volume: testVolume,
  selector: {
    normal: 'nVoice',
    operator: 'webSpeech',
    system: 'webSpeech',
  },
  voicevox: {
    normal: { id: '1', name: '' },
    operator: { id: '1', name: '' },
    system: { id: '1', name: '' },
  },
};

test('init preserves persisted speechSynthesizerSettings', () => {
  const persistedSettings = {
    enabled: false,
    pitch: 0.5,
    rate: 0.8,
    volume: 0.3,
    maxTime: 10,
    selector: { normal: 'webSpeech', operator: 'nVoice', system: 'nVoice' },
    voicevox: {
      normal: { id: '2', name: 'test' },
      operator: { id: '3', name: 'test2' },
      system: { id: '4', name: 'test3' },
    },
  };

  setup({
    injectee: {
      NicoliveProgramStateService: {
        updated: { subscribe() {} },
        state: { speechSynthesizerSettings: persistedSettings },
        updateSpeechSynthesizerSettings: jest.fn(),
      },
    },
  });

  const { NicoliveCommentSynthesizerService } = require('./nicolive-comment-synthesizer');
  const instance = NicoliveCommentSynthesizerService.instance() as NicoliveCommentSynthesizerService;

  expect(instance.state.pitch).toBe(persistedSettings.pitch);
  expect(instance.state.rate).toBe(persistedSettings.rate);
  expect(instance.state.volume).toBe(persistedSettings.volume);
  expect(instance.state.maxTime).toBe(persistedSettings.maxTime);
  expect(instance.state.enabled).toBe(persistedSettings.enabled);
  expect(instance.state.selector).toEqual(persistedSettings.selector);
  expect(instance.state.voicevox).toEqual(persistedSettings.voicevox);
  // 起動時に常にリセットされるフィールド
  expect(instance.state.soundDetectorEnabled).toBe(false);
});

test('makeSpeechText', async () => {
  setup();
  const { NicoliveCommentSynthesizerService } = require('./nicolive-comment-synthesizer');
  const instance = NicoliveCommentSynthesizerService.instance() as NicoliveCommentSynthesizerService;
  expect(
    instance.makeSpeechText({ type: 'normal', value: { content: 'test' }, seqId: 1 }, 'webSpeech'),
  ).toBe('test');

  const gift: WrappedMessage = {
    type: 'gift',
    value: {
      advertiserName: 'advertiserName',
      point: 100,
      itemName: 'itemName',
    },
    seqId: 1,
  } as const;
  expect(instance.makeSpeechText(gift, 'webSpeech')).toBe(
    `${gift.value.advertiserName}さんが「${gift.value.itemName}（${gift.value.point}pt）」を贈りました`,
  );
});

test('makeSpeech', async () => {
  setup();
  const { NicoliveCommentSynthesizerService } = require('./nicolive-comment-synthesizer');
  const instance = NicoliveCommentSynthesizerService.instance() as NicoliveCommentSynthesizerService;

  jest.spyOn(instance, 'state', 'get').mockReturnValue(mockedState);

  // 辞書変換しない
  jest
    .spyOn(instance, 'makeSpeechText')
    .mockImplementation(
      (chat: WrappedMessage) => (isWrappedChat(chat) && chat.value.content) || '',
    );

  const makeChat = (s: string): WrappedChat => ({
    type: 'normal',
    value: { content: s },
    seqId: 1,
  });

  const synthId = 'nVoice';
  // 空文字列を与えるとnullが返ってくる
  expect(instance.makeSpeech(makeChat(''))).toBeNull();

  // ignore 設定の時はnullが返ってくる
  expect(instance.makeSpeech(makeChat('test'), 'ignore')).toBeNull();

  // stateの設定値を反映している
  expect(instance.makeSpeech(makeChat('test'))).toEqual({
    text: 'test',
    synthesizer: 'nVoice',
    rate: testRate,
    webSpeech: {
      pitch: testPitch,
    },
    nVoice: {
      maxTime: testMaxTime,
    },
    volume: testVolume,
  });
});

test.each([
  ['normal', false, false, 0, 0, 1],
  ['cancelBeforeSpeaking', true, false, 1, 0, 1],
  ['NUM_COMMENTS_TO_SKIP', false, true, 0, 1, 1],
])(
  'queueToSpeech %s cancelBeforeSpeaking:%s filled:%s cancel:%d add:%d',
  async (
    name: string,
    cancelBeforeSpeaking: boolean,
    filled: boolean,
    numCancel: number,
    numCancelQueue: number,
    numAdd: number,
  ) => {
    setup();
    const { NicoliveCommentSynthesizerService } = require('./nicolive-comment-synthesizer');
    const instance = NicoliveCommentSynthesizerService.instance() as NicoliveCommentSynthesizerService;
    jest.spyOn(instance, 'state', 'get').mockReturnValue(mockedState);

    (instance.getSynthesizer('nVoice')!.speakText as jest.Mock).mockImplementation(
      (speech: Speech, onstart: () => void, onend: () => void) => {
        return async () => async () => {
          onstart();
          onend();
          return {
            cancel: async () => {},
            running: Promise.resolve(),
          };
        };
      },
    );

    const queue = instance.queue as jest.Mocked<QueueRunner>;

    const onstart = jest.fn();
    const onend = jest.fn();
    const speech: Speech = {
      text: 'test',
      synthesizer: 'nVoice',
      rate: testRate,
      volume: testVolume,
    };

    Object.defineProperty(queue, 'length', {
      get: () => (filled ? instance.NUM_COMMENTS_TO_SKIP : 0),
    });
    expect(queue.cancel).toHaveBeenCalledTimes(0);
    expect(queue.add).toHaveBeenCalledTimes(0);
    instance.queueToSpeech(speech, onstart, onend, cancelBeforeSpeaking);
    expect(queue.cancel).toHaveBeenCalledTimes(numCancel);
    expect(queue.cancelQueue).toHaveBeenCalledTimes(numCancelQueue);
    expect(queue.add).toHaveBeenCalledTimes(numAdd);
    if (numAdd) {
      expect(queue.add).toHaveBeenCalledWith(expect.anything(), speech.text);
    }
  },
);
