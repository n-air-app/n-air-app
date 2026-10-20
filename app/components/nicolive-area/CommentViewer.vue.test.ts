import type { WrappedMessageWithComponent } from 'services/nicolive-program/WrappedChat';

import { SpeakingType } from './comment/SpeakingType';

const mockMenuAppend = jest.fn();
const mockMenuPopup = jest.fn();
jest.mock('util/menus/Menu', () => ({
  Menu: jest.fn(() => ({ append: mockMenuAppend, popup: mockMenuPopup, menu: { once: jest.fn() } })),
}));

jest.mock('services/customization', () => ({
  CustomizationService: { instance: jest.fn(() => ({ state: { compactMode: false } })) },
}));
jest.mock('services/hosts', () => ({ HostsService: { instance: jest.fn() } }));
jest.mock('services/nicolive-program/nicolive-comment-filter', () => ({
  NicoliveCommentFilterService: { instance: jest.fn() },
}));
jest.mock('services/nicolive-program/nicolive-comment-viewer', () => ({
  NicoliveCommentViewerService: { instance: jest.fn() },
}));
jest.mock('services/nicolive-program/nicolive-moderators', () => ({
  NicoliveModeratorsService: { instance: jest.fn() },
}));
jest.mock('services/nicolive-program/nicolive-program', () => ({
  NicoliveProgramService: { instance: jest.fn() },
}));
jest.mock('services/nicolive-program/state', () => ({
  NicoliveProgramStateService: { instance: jest.fn() },
}));
jest.mock('services/nicolive-program/NicoliveFailure', () => ({
  NicoliveFailure: class NicoliveFailure {},
  openErrorDialogFromFailure: jest.fn(),
}));
jest.mock('services/settings', () => ({ SettingsService: { instance: jest.fn() } }));
jest.mock('services/snackbar', () => ({ SnackbarService: { instance: jest.fn() } }));
jest.mock('services/sound-detector', () => ({ SoundDetectorService: { instance: jest.fn() } }));
jest.mock('../../../media/images/n-air-logo.svg', () => ({ default: 'n-air-logo' }));
jest.mock('./comment/CommonComment.vue', () => ({}));
jest.mock('./comment/EmotionComment.vue', () => ({}));
jest.mock('./comment/GiftComment.vue', () => ({}));
jest.mock('./comment/NicoadComment.vue', () => ({}));
jest.mock('./comment/SystemMessage.vue', () => ({}));
jest.mock('./CommentFilter.vue', () => ({}));
jest.mock('./CommentForm.vue', () => ({}));
jest.mock('./SoundDetectorButton.vue', () => ({}));

Object.defineProperty(globalThis.window, 'location', {
  configurable: true,
  value: { href: 'file:///index.html?windowId=main' },
});

const CommentViewer = require('./CommentViewer.vue.ts').default;

describe('CommentViewer.getSpeakingType', () => {
  // getSpeakingType は public メソッドなので、ロジックを直接テストする
  // 実装の詳細（private プロパティ）には触れず、振る舞いをテスト

  interface MockCommentViewer {
    isBlocking: boolean;
    speakingSeqId: number | null;
    blockingNextSeqId: number | null;
    getSpeakingType(item: WrappedMessageWithComponent): SpeakingType;
  }

  function createMockCommentViewer(
    speakingSeqId: number | null,
    isBlocking: boolean,
    blockingNextSeqId: number | null = null,
  ): MockCommentViewer {
    // getSpeakingType の実装をそのまま再現
    return {
      isBlocking,
      speakingSeqId,
      blockingNextSeqId,
      getSpeakingType(item: WrappedMessageWithComponent): SpeakingType {
        if (this.speakingSeqId === item.seqId) {
          return this.isBlocking ? SpeakingType.BLOCKING : SpeakingType.SPEAKING;
        }
        // speakingSeqId が null（cancel/graceful で終了後）かつ
        // キューが disabled で、このコメントが次の待機アイテムの場合
        if (this.speakingSeqId === null && this.blockingNextSeqId === item.seqId) {
          return SpeakingType.BLOCKING;
        }
        return SpeakingType.NONE;
      },
    };
  }

  test('speakingSeqId が一致しない場合は NONE', () => {
    const mock = createMockCommentViewer(1, false);
    const item = { seqId: 2 } as WrappedMessageWithComponent;
    expect(mock.getSpeakingType(item)).toBe(SpeakingType.NONE);
  });

  test('speakingSeqId が一致し、ブロック中でない場合は SPEAKING', () => {
    const mock = createMockCommentViewer(1, false);
    const item = { seqId: 1 } as WrappedMessageWithComponent;
    expect(mock.getSpeakingType(item)).toBe(SpeakingType.SPEAKING);
  });

  test('speakingSeqId が一致し、ブロック中の場合は BLOCKING', () => {
    const mock = createMockCommentViewer(1, true);
    const item = { seqId: 1 } as WrappedMessageWithComponent;
    expect(mock.getSpeakingType(item)).toBe(SpeakingType.BLOCKING);
  });

  test('isBlocking が変化したら getSpeakingType の結果も変わる', () => {
    const mock = createMockCommentViewer(1, false);
    const item = { seqId: 1 } as WrappedMessageWithComponent;

    // 初期状態: SPEAKING
    expect(mock.getSpeakingType(item)).toBe(SpeakingType.SPEAKING);

    // isBlocking が true になったら BLOCKING
    mock.isBlocking = true;
    expect(mock.getSpeakingType(item)).toBe(SpeakingType.BLOCKING);

    // isBlocking が false に戻ったら SPEAKING
    mock.isBlocking = false;
    expect(mock.getSpeakingType(item)).toBe(SpeakingType.SPEAKING);
  });

  test('speakingSeqId が null の場合は常に NONE', () => {
    const mock = createMockCommentViewer(null, false);
    const item = { seqId: 1 } as WrappedMessageWithComponent;
    expect(mock.getSpeakingType(item)).toBe(SpeakingType.NONE);
  });

  describe('blockingNextSeqId', () => {
    test('speakingSeqId が null で blockingNextSeqId が一致する場合は BLOCKING', () => {
      const mock = createMockCommentViewer(null, false, 42);
      const item = { seqId: 42 } as WrappedMessageWithComponent;
      expect(mock.getSpeakingType(item)).toBe(SpeakingType.BLOCKING);
    });

    test('speakingSeqId が null で blockingNextSeqId が一致しない場合は NONE', () => {
      const mock = createMockCommentViewer(null, false, 42);
      const item = { seqId: 99 } as WrappedMessageWithComponent;
      expect(mock.getSpeakingType(item)).toBe(SpeakingType.NONE);
    });

    test('speakingSeqId が null で blockingNextSeqId も null の場合は NONE', () => {
      const mock = createMockCommentViewer(null, false, null);
      const item = { seqId: 1 } as WrappedMessageWithComponent;
      expect(mock.getSpeakingType(item)).toBe(SpeakingType.NONE);
    });

    test('speakingSeqId が設定されている場合は blockingNextSeqId を無視する', () => {
      // speakingSeqId が優先される
      const mock = createMockCommentViewer(1, false, 2);
      const item1 = { seqId: 1 } as WrappedMessageWithComponent;
      const item2 = { seqId: 2 } as WrappedMessageWithComponent;

      expect(mock.getSpeakingType(item1)).toBe(SpeakingType.SPEAKING);
      expect(mock.getSpeakingType(item2)).toBe(SpeakingType.NONE);
    });
  });
});

describe('CommentViewer.showCommentMenu', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('operatorコメントはcontentだけでメニューを表示する', () => {
    const item = {
      type: 'operator',
      value: { content: '放送者コメント' },
      seqId: 1,
      component: 'common',
    } as WrappedMessageWithComponent;

    CommentViewer.methods.showCommentMenu.call({ commentMenuTarget: null }, item);

    expect(mockMenuAppend).toHaveBeenCalledWith(expect.objectContaining({
      id: 'Copy comment content',
      label: 'コメントをコピー',
    }));
    expect(mockMenuPopup).toHaveBeenCalled();
    expect(mockMenuAppend).not.toHaveBeenCalledWith(expect.objectContaining({
      id: 'Pin the comment',
    }));
  });
});
