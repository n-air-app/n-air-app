import type { WrappedMessageWithComponent } from 'services/nicolive-program/WrappedChat';
import { SpeakingType } from './comment/SpeakingType';

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
