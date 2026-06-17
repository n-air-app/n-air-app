import * as FakeTimers from '@sinonjs/fake-timers';
import { Subject } from 'rxjs';
import type { INicoliveProgramState } from 'services/nicolive-program/nicolive-program';
import type { CommentModifier } from 'services/nicolive-program/NicoliveClient';
import type { ITranscriptionServiceState, TimestampedText } from 'services/transcription/transcription';
import { jest_fn } from 'util/jest_fn';
import { createSetupFunction } from 'util/test-setup';

import type CommentFormType from './CommentForm.vue';

// Type aliases to avoid repetition
type MockProgramState = Pick<INicoliveProgramState, 'programID' | 'status'>;
type MockTranscriptionState = Pick<
  ITranscriptionServiceState,
  | 'commentEnabled'
  | 'commentPostDelay'
  | 'commentPosition'
  | 'commentFont'
  | 'commentColor'
  | 'commentSize'
>;

// Test-specific mock service types
// Note: These mock types only include properties actually used in CommentForm
type MockNicoliveProgramService = {
  state: MockProgramState;
  sendOperatorComment: jest.Mock<Promise<void>, [text: string, isPermanent: boolean]>;
  sendNormalComment: jest.Mock<
    Promise<void>,
    [text: string, vpos: number, modifier: CommentModifier]
  >;
  getVposFromDate: jest.Mock<number, [date: Date]>;
};

type MockTranscriptionService = {
  state: MockTranscriptionState;
  text$: Subject<TimestampedText>;
};

type MockUserService = Record<string, never>;

// Test constants
const TEST_PROGRAM_ID = 'lv123456';
const TEST_VPOS = 1000;

// Separate constants for each type to avoid type conflicts
const TEST_COMMENT_POSITION = 'naka' as const;
const TEST_COMMENT_FONT = 'defont' as const;
const TEST_COMMENT_COLOR = 'white' as const;
const TEST_COMMENT_SIZE = 'medium' as const;

const TEST_COMMENT_MODIFIER: CommentModifier = {
  position: TEST_COMMENT_POSITION,
  font: TEST_COMMENT_FONT,
  color: TEST_COMMENT_COLOR,
  size: TEST_COMMENT_SIZE,
};

// Mock nicolive-logger
const mockSendLogGif = jest_fn().mockName('sendLogGif').mockResolvedValue(undefined);
jest.mock('services/nicolive-program/nicolive-logger', () => ({
  sendLogGif: mockSendLogGif,
}));

// Mock Vue
jest.mock('vue', () => {
  class Vue {
    $refs: any = {};
    $nextTick(fn: () => void) {
      Promise.resolve().then(fn);
    }
  }
  function defineComponent(options: any): any {
    class Component extends Vue {
      constructor() {
        super();
        if (options.setup) Object.assign(this, options.setup.call(this));
        if (options.created) options.created.call(this);
        if (options.data) Object.assign(this, options.data.call(this));
      }
    }
    if (options.computed) {
      for (const [key, fn] of Object.entries(options.computed as Record<string, any>)) {
        Object.defineProperty(Component.prototype, key, { get: fn, configurable: true });
      }
    }
    if (options.methods) Object.assign(Component.prototype, options.methods);
    for (const hook of ['mounted', 'beforeUnmount', 'unmounted', 'created']) {
      if (options[hook]) (Component.prototype as any)[hook] = options[hook];
    }
    return Component;
  }
  return { __esModule: true, default: Vue, defineComponent };
});

describe('CommentForm', () => {
  let clock: FakeTimers.InstalledClock;
  let transcriptionText$: Subject<TimestampedText>;
  let mockNicoliveProgramService: MockNicoliveProgramService;
  let mockTranscriptionService: MockTranscriptionService;
  let mockUserService: MockUserService;
  let programState: MockProgramState;
  let transcriptionState: MockTranscriptionState;

  const setup = createSetupFunction({
    state: {},
    injectee: {},
  });

  beforeEach(() => {
    clock = FakeTimers.install();

    jest.doMock('services/core/stateful-service');
    jest.doMock('services/core/injector');

    transcriptionText$ = new Subject<TimestampedText>();

    // Shared state objects
    programState = {
      programID: TEST_PROGRAM_ID,
      status: 'onAir',
    };

    transcriptionState = {
      commentEnabled: true,
      commentPostDelay: 0,
      commentPosition: TEST_COMMENT_POSITION,
      commentFont: TEST_COMMENT_FONT,
      commentColor: TEST_COMMENT_COLOR,
      commentSize: TEST_COMMENT_SIZE,
    };

    mockNicoliveProgramService = {
      state: programState,
      sendOperatorComment: jest_fn<(text: string, isPermanent: boolean) => Promise<void>>()
        .mockName('sendOperatorComment')
        .mockResolvedValue(undefined),
      sendNormalComment: jest_fn<(text: string, vpos: number, modifier: CommentModifier) => Promise<void>
      >()
        .mockName('sendNormalComment')
        .mockResolvedValue(undefined),
      getVposFromDate: jest_fn<(date: Date) => number>()
        .mockName('getVposFromDate')
        .mockReturnValue(TEST_VPOS),
    };

    mockTranscriptionService = {
      state: transcriptionState,
      text$: transcriptionText$,
    };

    mockUserService = {};
  });

  afterEach(() => {
    clock.uninstall();
    jest.clearAllMocks();
    jest.resetModules();
  });

  /**
   * Creates a CommentForm instance with current mock services
   */
  function createInstance(): any {
    setup({
      injectee: {
        NicoliveProgramService: mockNicoliveProgramService,
        TranscriptionService: mockTranscriptionService,
        UserService: mockUserService,
      },
    });

    const CommentForm = require('./CommentForm.vue.ts').default as typeof CommentFormType;
    const instance = new CommentForm() as any;
    instance.mounted();
    return instance;
  }

  /**
   * Helper to send transcribed text and wait for processing
   */
  async function sendTranscribedText(text: string): Promise<void> {
    transcriptionText$.next({ text, timestamp: Date.now() });
    await clock.tickAsync(0);
  }

  describe('commentEnabled = false の場合', () => {
    beforeEach(() => {
      transcriptionState.commentEnabled = false;
    });

    it('文字起こしコメントがキューに追加されても即座に成功扱いになる', async () => {
      const instance = createInstance();

      // 文字起こしテキストを送信
      await sendTranscribedText('テストコメント');

      // コメント送信は呼ばれない
      expect(mockNicoliveProgramService.sendNormalComment).not.toHaveBeenCalled();

      // 別のコメントを追加しても処理が続行される（キューがブロックされていない）
      await sendTranscribedText('次のコメント');

      // 引き続き送信されない
      expect(mockNicoliveProgramService.sendNormalComment).not.toHaveBeenCalled();

      instance.beforeUnmount();
    });

    it('ログは送信される', async () => {
      const instance = createInstance();

      const testText = 'ログテスト';
      await sendTranscribedText(testText);

      // ログは送信される
      expect(mockSendLogGif).toHaveBeenCalledWith(
        'transcription',
        TEST_PROGRAM_ID,
        { text: testText },
      );

      instance.beforeUnmount();
    });

    it('放送者コメントは送信できる', async () => {
      const instance = createInstance();

      // 放送者コメントを送信
      instance.operatorCommentValue = '放送者コメント';
      const mockEvent = { ctrlKey: false } as MouseEvent;

      await instance.sendOperatorComment(mockEvent);

      // 放送者コメントは正常に送信される
      expect(mockNicoliveProgramService.sendOperatorComment).toHaveBeenCalledWith(
        '放送者コメント',
        false,
      );
      expect(instance.operatorCommentValue).toBe('');

      instance.beforeUnmount();
    });
  });

  describe('commentEnabled = true の場合', () => {
    beforeEach(() => {
      transcriptionState.commentEnabled = true;
    });

    it('文字起こしコメントが送信される', async () => {
      const instance = createInstance();

      const testText = '文字起こしコメント';
      await sendTranscribedText(testText);

      // コメントが送信される
      expect(mockNicoliveProgramService.sendNormalComment).toHaveBeenCalledWith(
        testText,
        TEST_VPOS,
        TEST_COMMENT_MODIFIER,
      );

      instance.beforeUnmount();
    });

    it('ログも送信される', async () => {
      const instance = createInstance();

      const testText = '文字起こしログ';
      await sendTranscribedText(testText);

      // ログが送信される
      expect(mockSendLogGif).toHaveBeenCalledWith(
        'transcription',
        TEST_PROGRAM_ID,
        { text: testText },
      );

      instance.beforeUnmount();
    });
  });

  describe('isSendable の動作', () => {
    it('isCommentSending が true の時は送信不可', () => {
      const instance = createInstance();

      // 初期状態: 送信可能
      expect(instance.isSendable).toBe(true);

      // isCommentSending = true: 送信不可
      instance.isCommentSending = true;
      expect(instance.isSendable).toBe(false);

      // isCommentSending = false: 送信可能
      instance.isCommentSending = false;
      expect(instance.isSendable).toBe(true);

      instance.beforeUnmount();
    });

    it('programEnded が true の時は送信不可', () => {
      programState.status = 'end';
      const instance = createInstance();

      // programEnded: 送信不可
      expect(instance.programEnded).toBe(true);
      expect(instance.isSendable).toBe(false);

      instance.beforeUnmount();
    });

    it('commentEnabled = true でも isSendable は同じ動作', () => {
      transcriptionState.commentEnabled = true;
      const instance = createInstance();

      // 初期状態: 送信可能
      expect(instance.isSendable).toBe(true);

      // isCommentSending = true: 送信不可
      instance.isCommentSending = true;
      expect(instance.isSendable).toBe(false);

      instance.beforeUnmount();
    });
  });

  describe('キューの再開機能', () => {
    it('isSendable が true になるとキューが再開される', async () => {
      transcriptionState.commentEnabled = true;
      const instance = createInstance();

      // コメント送信中にする
      instance.isCommentSending = true;

      // 文字起こしテキストを送信
      const testText = 'キュー待ちコメント';
      await sendTranscribedText(testText);

      // コメントはまだ送信されない
      expect(mockNicoliveProgramService.sendNormalComment).not.toHaveBeenCalled();

      // 送信完了
      instance.isCommentSending = false;
      // @Watch デコレータはモックでは動作しないので、手動で onIsSendableChanged を呼び出す
      instance.onIsSendableChanged(instance.isSendable);

      // キューが再開される
      await clock.tickAsync(0);

      // コメントが送信される
      expect(mockNicoliveProgramService.sendNormalComment).toHaveBeenCalledWith(
        testText,
        TEST_VPOS,
        TEST_COMMENT_MODIFIER,
      );

      instance.beforeUnmount();
    });
  });

  describe('空のテキストは処理しない', () => {
    it('空のテキストはキューに追加されない', async () => {
      const instance = createInstance();

      // 空のテキストを送信
      transcriptionText$.next({ text: '', timestamp: Date.now() });

      // キューの処理を待つ
      await clock.tickAsync(0);

      // コメントは送信されない
      expect(mockNicoliveProgramService.sendNormalComment).not.toHaveBeenCalled();
      // ログも送信されない
      expect(mockSendLogGif).not.toHaveBeenCalled();

      instance.beforeUnmount();
    });

    it('空の放送者コメントは送信されない', async () => {
      const instance = createInstance();

      // 空の放送者コメント
      instance.operatorCommentValue = '';
      const mockEvent = { ctrlKey: false } as MouseEvent;

      await instance.sendOperatorComment(mockEvent);

      // 送信されない
      expect(mockNicoliveProgramService.sendOperatorComment).not.toHaveBeenCalled();

      instance.beforeUnmount();
    });
  });
});
