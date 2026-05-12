import Vue from 'vue';
import { TocManager } from './TocManager';

// Mock Vue.observable, Vue.set, Vue.delete
jest.mock('vue', () => {
  const actualVue = jest.requireActual('vue');
  return {
    ...actualVue,
    default: {
      ...actualVue.default,
      observable: (obj: any) => obj,
      set: (target: any, key: string, value: any) => {
        target[key] = value;
      },
      delete: (target: any, key: string) => {
        delete target[key];
      },
    },
  };
});

interface TocSectionData {
  id: string;
  title: string;
  order: number;
  level: number;
}

describe('TocManager', () => {
  let manager: TocManager;

  beforeEach(() => {
    manager = new TocManager();
    // Clear DOM between tests
    document.body.innerHTML = '';
  });

  describe('generateId', () => {
    it('連続して呼び出すと一意のIDが生成される', () => {
      const id1 = manager.generateId();
      const id2 = manager.generateId();
      const id3 = manager.generateId();

      expect(id1).toBe('toc-section-0');
      expect(id2).toBe('toc-section-1');
      expect(id3).toBe('toc-section-2');
    });

    it('異なるインスタンスではカウンターが独立している', () => {
      const manager1 = new TocManager();
      const manager2 = new TocManager();

      expect(manager1.generateId()).toBe('toc-section-0');
      expect(manager2.generateId()).toBe('toc-section-0');
      expect(manager1.generateId()).toBe('toc-section-1');
      expect(manager2.generateId()).toBe('toc-section-1');
    });
  });

  describe('register', () => {
    it('セクションを登録できる', () => {
      const section: TocSectionData = {
        id: 'test-1',
        title: 'Test Section',
        order: 0,
        level: 1,
      };

      manager.register('General', section);

      const sections = manager.getSections('General');
      expect(sections).toHaveLength(1);
      expect(sections[0]).toEqual(section);
    });

    it('同じカテゴリに複数のセクションを登録できる', () => {
      manager.register('General', {
        id: 'section-1',
        title: 'Section 1',
        order: 0,
        level: 1,
      });
      manager.register('General', {
        id: 'section-2',
        title: 'Section 2',
        order: 0,
        level: 1,
      });
      manager.register('General', {
        id: 'section-3',
        title: 'Section 3',
        order: 0,
        level: 1,
      });

      const sections = manager.getSections('General');
      expect(sections).toHaveLength(3);
    });

    it('異なるカテゴリに別々にセクションを登録できる', () => {
      manager.register('General', {
        id: 'general-1',
        title: 'General Section',
        order: 0,
        level: 1,
      });
      manager.register('Comment', {
        id: 'comment-1',
        title: 'Comment Section',
        order: 0,
        level: 1,
      });

      expect(manager.getSections('General')).toHaveLength(1);
      expect(manager.getSections('Comment')).toHaveLength(1);
      expect(manager.getSections('General')[0].id).toBe('general-1');
      expect(manager.getSections('Comment')[0].id).toBe('comment-1');
    });

    it('重複したIDのセクションは登録されない', () => {
      const section: TocSectionData = {
        id: 'duplicate-id',
        title: 'Section 1',
        order: 0,
        level: 1,
      };

      manager.register('General', section);
      manager.register('General', section);
      manager.register('General', section);

      const sections = manager.getSections('General');
      expect(sections).toHaveLength(1);
    });

    it('order が配列のインデックスに基づいて更新される', () => {
      manager.register('General', {
        id: 'section-1',
        title: 'Section 1',
        order: 999, // 初期値は無視される
        level: 1,
      });
      manager.register('General', {
        id: 'section-2',
        title: 'Section 2',
        order: 999,
        level: 1,
      });
      manager.register('General', {
        id: 'section-3',
        title: 'Section 3',
        order: 999,
        level: 1,
      });

      const sections = manager.getSections('General');
      expect(sections[0].order).toBe(0);
      expect(sections[1].order).toBe(1);
      expect(sections[2].order).toBe(2);
    });

    it('DOM要素が存在しない場合は末尾に追加される', () => {
      // DOM要素を作成しない状態で登録
      manager.register('General', {
        id: 'section-a',
        title: 'Section A',
        order: 0,
        level: 1,
      });
      manager.register('General', {
        id: 'section-b',
        title: 'Section B',
        order: 0,
        level: 1,
      });

      const sections = manager.getSections('General');
      expect(sections[0].id).toBe('section-a');
      expect(sections[1].id).toBe('section-b');
    });

    it('DOM要素が存在する場合はDOM順序に基づいて挿入される', () => {
      // DOM要素を作成（逆順）
      document.body.innerHTML = `
        <div id="section-3"></div>
        <div id="section-2"></div>
        <div id="section-1"></div>
      `;

      // 登録順序はDOM順序と異なる
      manager.register('General', {
        id: 'section-1',
        title: 'Section 1',
        order: 0,
        level: 1,
      });
      manager.register('General', {
        id: 'section-2',
        title: 'Section 2',
        order: 0,
        level: 1,
      });
      manager.register('General', {
        id: 'section-3',
        title: 'Section 3',
        order: 0,
        level: 1,
      });

      const sections = manager.getSections('General');
      // DOM順序（section-3, section-2, section-1）に従って並ぶ
      expect(sections[0].id).toBe('section-3');
      expect(sections[1].id).toBe('section-2');
      expect(sections[2].id).toBe('section-1');
    });
  });

  describe('unregister', () => {
    beforeEach(() => {
      manager.register('General', {
        id: 'section-1',
        title: 'Section 1',
        order: 0,
        level: 1,
      });
      manager.register('General', {
        id: 'section-2',
        title: 'Section 2',
        order: 0,
        level: 1,
      });
      manager.register('General', {
        id: 'section-3',
        title: 'Section 3',
        order: 0,
        level: 1,
      });
    });

    it('指定したIDのセクションを削除できる', () => {
      manager.unregister('General', 'section-2');

      const sections = manager.getSections('General');
      expect(sections).toHaveLength(2);
      expect(sections[0].id).toBe('section-1');
      expect(sections[1].id).toBe('section-3');
    });

    it('存在しないIDを指定しても何も起きない', () => {
      manager.unregister('General', 'non-existent');

      const sections = manager.getSections('General');
      expect(sections).toHaveLength(3);
    });

    it('異なるカテゴリには影響しない', () => {
      manager.register('Comment', {
        id: 'comment-1',
        title: 'Comment Section',
        order: 0,
        level: 1,
      });

      manager.unregister('General', 'section-1');

      expect(manager.getSections('General')).toHaveLength(2);
      expect(manager.getSections('Comment')).toHaveLength(1);
    });
  });

  describe('getSections', () => {
    it('登録されたセクションを取得できる', () => {
      manager.register('General', {
        id: 'test-1',
        title: 'Test',
        order: 0,
        level: 1,
      });

      const sections = manager.getSections('General');
      expect(sections).toHaveLength(1);
      expect(sections[0].id).toBe('test-1');
    });

    it('セクションがない場合は空配列を返す', () => {
      const sections = manager.getSections('NonExistent');
      expect(sections).toEqual([]);
    });

    it('カテゴリごとに独立したセクションリストを返す', () => {
      manager.register('General', { id: 'g1', title: 'G1', order: 0, level: 1 });
      manager.register('Comment', { id: 'c1', title: 'C1', order: 0, level: 1 });

      const generalSections = manager.getSections('General');
      const commentSections = manager.getSections('Comment');

      expect(generalSections).toHaveLength(1);
      expect(commentSections).toHaveLength(1);
      expect(generalSections[0].id).toBe('g1');
      expect(commentSections[0].id).toBe('c1');
    });
  });

  describe('clear', () => {
    beforeEach(() => {
      manager.register('General', { id: 'g1', title: 'G1', order: 0, level: 1 });
      manager.register('General', { id: 'g2', title: 'G2', order: 0, level: 1 });
      manager.register('Comment', { id: 'c1', title: 'C1', order: 0, level: 1 });
    });

    it('指定したカテゴリのセクションをクリアできる', () => {
      manager.clear('General');

      expect(manager.getSections('General')).toEqual([]);
      expect(manager.getSections('Comment')).toHaveLength(1);
    });

    it('存在しないカテゴリをクリアしても何も起きない', () => {
      manager.clear('NonExistent');

      expect(manager.getSections('General')).toHaveLength(2);
      expect(manager.getSections('Comment')).toHaveLength(1);
    });
  });

  describe('clearAll', () => {
    beforeEach(() => {
      manager.register('General', { id: 'g1', title: 'G1', order: 0, level: 1 });
      manager.register('Comment', { id: 'c1', title: 'C1', order: 0, level: 1 });
      manager.register('Stream', { id: 's1', title: 'S1', order: 0, level: 1 });
    });

    it('全てのカテゴリのセクションをクリアできる', () => {
      manager.clearAll();

      expect(manager.getSections('General')).toEqual([]);
      expect(manager.getSections('Comment')).toEqual([]);
      expect(manager.getSections('Stream')).toEqual([]);
    });
  });

  describe('duplicate prevention', () => {
    it('同じカテゴリに同じセクションを再登録しようとすると無視される', () => {
      const section: TocSectionData = {
        id: 'test-section',
        title: 'Test',
        order: 0,
        level: 1,
      };

      manager.register('General', section);
      manager.register('General', section);
      manager.register('General', section);

      expect(manager.getSections('General')).toHaveLength(1);
    });

    it('カテゴリ再選択シナリオ: clear してから再登録', () => {
      // 初回選択
      manager.register('Comment', { id: 'section-1', title: 'S1', order: 0, level: 1 });
      manager.register('Comment', { id: 'section-2', title: 'S2', order: 0, level: 1 });
      expect(manager.getSections('Comment')).toHaveLength(2);

      // 別のカテゴリに切り替え
      manager.register('General', { id: 'general-1', title: 'G1', order: 0, level: 1 });
      expect(manager.getSections('General')).toHaveLength(1);
      expect(manager.getSections('Comment')).toHaveLength(2); // Comment は残っている

      // Comment に戻る前にクリア（Settings の Watch で実行される）
      manager.clear('Comment');
      expect(manager.getSections('Comment')).toHaveLength(0);

      // Comment に戻って再登録
      manager.register('Comment', { id: 'section-1', title: 'S1', order: 0, level: 1 });
      manager.register('Comment', { id: 'section-2', title: 'S2', order: 0, level: 1 });
      expect(manager.getSections('Comment')).toHaveLength(2);
    });

    it('同じカテゴリを連続選択: clear してから再登録', () => {
      // 初回選択
      manager.register('General', { id: 'g1', title: 'G1', order: 0, level: 1 });
      manager.register('General', { id: 'g2', title: 'G2', order: 0, level: 1 });
      expect(manager.getSections('General')).toHaveLength(2);

      // 同じカテゴリを再選択（Settings の Watch でクリアされる）
      manager.clear('General');
      expect(manager.getSections('General')).toHaveLength(0);

      // 再登録
      manager.register('General', { id: 'g1', title: 'G1', order: 0, level: 1 });
      manager.register('General', { id: 'g2', title: 'G2', order: 0, level: 1 });
      expect(manager.getSections('General')).toHaveLength(2);
    });

    it('複数回の再選択でもセクション数が正しい', () => {
      for (let i = 0; i < 5; i++) {
        manager.clear('General');
        manager.register('General', { id: 'g1', title: 'G1', order: 0, level: 1 });
        manager.register('General', { id: 'g2', title: 'G2', order: 0, level: 1 });
        manager.register('General', { id: 'g3', title: 'G3', order: 0, level: 1 });

        expect(manager.getSections('General')).toHaveLength(3);
      }
    });
  });

  describe('integration scenarios', () => {
    it('複雑な階層構造を正しく管理できる', () => {
      manager.register('Comment', {
        id: 'display',
        title: '表示設定',
        order: 0,
        level: 1,
      });
      manager.register('Comment', {
        id: 'speech',
        title: '読み上げ設定',
        order: 0,
        level: 1,
      });
      manager.register('Comment', {
        id: 'audio',
        title: '音声設定',
        order: 0,
        level: 2,
      });
      manager.register('Comment', {
        id: 'distribution',
        title: '振り分け設定',
        order: 0,
        level: 2,
      });

      const sections = manager.getSections('Comment');
      expect(sections).toHaveLength(4);
      expect(sections.map((s) => s.level)).toEqual([1, 1, 2, 2]);
    });

    it('カテゴリ切り替えシナリオ', () => {
      // Generalカテゴリにセクション追加
      manager.register('General', { id: 'g1', title: 'G1', order: 0, level: 1 });

      // Commentカテゴリに切り替え
      manager.register('Comment', { id: 'c1', title: 'C1', order: 0, level: 1 });

      // 両方独立して存在
      expect(manager.getSections('General')).toHaveLength(1);
      expect(manager.getSections('Comment')).toHaveLength(1);

      // Generalをクリア
      manager.clear('General');

      // Commentは影響を受けない
      expect(manager.getSections('General')).toEqual([]);
      expect(manager.getSections('Comment')).toHaveLength(1);
    });
  });

  describe('consecutive duplicate title filtering', () => {
    it('連続する同名・同レベルのセクションは2つ目以降を除外', () => {
      manager.register('Advanced', {
        id: 'audio-1',
        title: '音声',
        order: 0,
        level: 1,
      });
      manager.register('Advanced', {
        id: 'audio-2',
        title: '音声',
        order: 0,
        level: 1,
      });

      const sections = manager.getSections('Advanced');
      expect(sections).toHaveLength(1);
      expect(sections[0].id).toBe('audio-1');
      expect(sections[0].title).toBe('音声');
    });

    it('連続する同名でも異なるレベルは両方表示', () => {
      manager.register('Comment', {
        id: 'voice-parent',
        title: '音声',
        order: 0,
        level: 1,
      });
      manager.register('Comment', {
        id: 'voice-child',
        title: '音声',
        order: 0,
        level: 2,
      });

      const sections = manager.getSections('Comment');
      expect(sections).toHaveLength(2);
      expect(sections[0]).toEqual({
        id: 'voice-parent',
        title: '音声',
        order: 0,
        level: 1,
      });
      expect(sections[1]).toEqual({
        id: 'voice-child',
        title: '音声',
        order: 1,
        level: 2,
      });
    });

    it('連続しない同名セクションは両方表示', () => {
      manager.register('Advanced', {
        id: 'audio-1',
        title: '音声',
        order: 0,
        level: 1,
      });
      manager.register('Advanced', {
        id: 'video-1',
        title: 'ビデオ',
        order: 0,
        level: 1,
      });
      manager.register('Advanced', {
        id: 'audio-2',
        title: '音声',
        order: 0,
        level: 1,
      });

      const sections = manager.getSections('Advanced');
      expect(sections).toHaveLength(3);
      expect(sections[0].title).toBe('音声');
      expect(sections[1].title).toBe('ビデオ');
      expect(sections[2].title).toBe('音声');
    });

    it('DOM順序ベースの挿入でも連続重複を除外', () => {
      // DOM要素を作成
      document.body.innerHTML = `
        <div id="audio-1"></div>
        <div id="audio-2"></div>
        <div id="video-1"></div>
      `;

      // DOM順序でaudio-1が最初
      manager.register('Advanced', {
        id: 'audio-1',
        title: '音声',
        order: 0,
        level: 1,
      });

      // audio-2はaudio-1の直後にあるので除外される
      manager.register('Advanced', {
        id: 'audio-2',
        title: '音声',
        order: 0,
        level: 1,
      });

      // video-1は挿入される
      manager.register('Advanced', {
        id: 'video-1',
        title: 'ビデオ',
        order: 0,
        level: 1,
      });

      const sections = manager.getSections('Advanced');
      expect(sections).toHaveLength(2);
      expect(sections[0].id).toBe('audio-1');
      expect(sections[0].title).toBe('音声');
      expect(sections[1].id).toBe('video-1');
      expect(sections[1].title).toBe('ビデオ');
    });
  });
});
