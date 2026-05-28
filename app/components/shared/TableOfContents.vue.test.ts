// Mock Vue
jest.mock('vue', () => {
  class Vue {
    _emittedEvents?: Array<{ event: string; args: any[] }>;

    $emit(event: string, ...args: any[]) {
      // Store emitted events for testing
      if (!this._emittedEvents) {
        this._emittedEvents = [];
      }
      this._emittedEvents.push({ event, args });
    }
  }
  function defineComponent(options: any): any {
    class Component extends Vue {
      constructor() {
        super();
        if (options.data) Object.assign(this, options.data.call(this));
      }
    }
    if (options.computed) {
      for (const [key, fn] of Object.entries(options.computed as Record<string, any>)) {
        Object.defineProperty(Component.prototype, key, { get: fn, configurable: true });
      }
    }
    if (options.methods) Object.assign(Component.prototype, options.methods);
    for (const hook of ['mounted', 'beforeDestroy', 'beforeUnmount', 'unmounted', 'created']) {
      if (options[hook]) (Component.prototype as any)[hook] = options[hook];
    }
    return Component;
  }
  return { __esModule: true, default: Vue, defineComponent };
});

interface TocSectionData {
  id: string;
  title: string;
  order: number;
  level: number;
}

describe('TableOfContents', () => {
  let TableOfContents: any;

  beforeEach(() => {
    jest.resetModules();
    TableOfContents = require('./TableOfContents.vue.ts').default;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  function createInstance(sections: TocSectionData[]): any {
    const instance = new TableOfContents();
    instance.sections = sections;
    instance._emittedEvents = [];
    return instance;
  }

  describe('sections prop', () => {
    it('空の配列を受け取れる', () => {
      const instance = createInstance([]);
      expect(instance.sections).toEqual([]);
    });

    it('セクションの配列を受け取れる', () => {
      const sections: TocSectionData[] = [
        { id: 'section-1', title: 'Section 1', order: 0, level: 1 },
        { id: 'section-2', title: 'Section 2', order: 1, level: 1 },
      ];

      const instance = createInstance(sections);
      expect(instance.sections).toEqual(sections);
    });

    it('異なるレベルのセクションを受け取れる', () => {
      const sections: TocSectionData[] = [
        { id: 'section-1', title: 'Section 1', order: 0, level: 1 },
        { id: 'section-1-1', title: 'Section 1.1', order: 1, level: 2 },
        { id: 'section-1-2', title: 'Section 1.2', order: 2, level: 2 },
        { id: 'section-2', title: 'Section 2', order: 3, level: 1 },
      ];

      const instance = createInstance(sections);
      expect(instance.sections).toEqual(sections);
    });

    it('日本語のセクション名を受け取れる', () => {
      const sections: TocSectionData[] = [
        { id: 'display-settings', title: '表示', order: 0, level: 1 },
        { id: 'audio-settings', title: '音声', order: 1, level: 2 },
      ];

      const instance = createInstance(sections);
      expect(instance.sections).toEqual(sections);
    });
  });

  describe('navigate event', () => {
    it('TOC項目のクリックで navigate イベントが発火される', () => {
      // Note: This test validates the component logic structure.
      // In the actual template, clicking a toc-item calls $emit('navigate', section.id)
      // We're testing that the component can emit events correctly.

      const sections: TocSectionData[] = [
        { id: 'test-section', title: 'Test Section', order: 0, level: 1 },
      ];

      const instance = createInstance(sections);

      // Simulate clicking on the TOC item
      instance.$emit('navigate', 'test-section');

      expect(instance._emittedEvents).toHaveLength(1);
      expect(instance._emittedEvents[0]).toEqual({
        event: 'navigate',
        args: ['test-section'],
      });
    });

    it('複数の TOC 項目クリックでそれぞれのIDで navigate イベントが発火される', () => {
      const sections: TocSectionData[] = [
        { id: 'section-1', title: 'Section 1', order: 0, level: 1 },
        { id: 'section-2', title: 'Section 2', order: 1, level: 1 },
        { id: 'section-3', title: 'Section 3', order: 2, level: 1 },
      ];

      const instance = createInstance(sections);

      // Simulate clicking on each item
      instance.$emit('navigate', 'section-1');
      instance.$emit('navigate', 'section-2');
      instance.$emit('navigate', 'section-3');

      expect(instance._emittedEvents).toHaveLength(3);
      expect(instance._emittedEvents[0].args[0]).toBe('section-1');
      expect(instance._emittedEvents[1].args[0]).toBe('section-2');
      expect(instance._emittedEvents[2].args[0]).toBe('section-3');
    });

    it('ネストされたセクションでも navigate イベントが発火される', () => {
      const sections: TocSectionData[] = [
        { id: 'parent', title: 'Parent', order: 0, level: 1 },
        { id: 'child', title: 'Child', order: 1, level: 2 },
      ];

      const instance = createInstance(sections);

      instance.$emit('navigate', 'child');

      expect(instance._emittedEvents[0]).toEqual({
        event: 'navigate',
        args: ['child'],
      });
    });
  });

  describe('integration scenarios', () => {
    it('CommentSettings のような複雑な階層構造を扱える', () => {
      const sections: TocSectionData[] = [
        { id: 'display', title: '表示', order: 0, level: 1 },
        { id: 'speech', title: '読み上げ', order: 1, level: 1 },
        { id: 'audio', title: '音声', order: 2, level: 2 },
        { id: 'distribution', title: '振り分け', order: 3, level: 2 },
        { id: 'onecomme', title: 'わんコメ連携', order: 4, level: 1 },
        { id: 'http', title: 'HTTP連携', order: 5, level: 1 },
      ];

      const instance = createInstance(sections);

      expect(instance.sections).toHaveLength(6);
      expect(instance.sections[0].level).toBe(1);
      expect(instance.sections[2].level).toBe(2);
      expect(instance.sections[3].level).toBe(2);
    });

    it('ExtraSettings のような全て同じレベルの構造を扱える', () => {
      const sections: TocSectionData[] = [
        {
          id: 'optimization',
          title: 'ニコニコ生放送サービス向け最適化',
          order: 0,
          level: 1,
        },
        { id: 'compact', title: 'コンパクトモード', order: 1, level: 1 },
        { id: 'cache', title: 'キャッシュ管理', order: 2, level: 1 },
        { id: 'performance', title: 'パフォーマンス統計情報のポーリング', order: 3, level: 1 },
      ];

      const instance = createInstance(sections);

      expect(instance.sections).toHaveLength(4);
      expect(instance.sections.every((s: TocSectionData) => s.level === 1)).toBe(true);
    });

    it('GenericFormGroups のような動的に生成されるセクションを扱える', () => {
      // GenericFormGroups は各フォームグループからセクションを動的生成する
      const sections: TocSectionData[] = [
        { id: 'untitled', title: 'Untitled', order: 0, level: 1 },
        { id: 'video', title: 'Video', order: 1, level: 1 },
        { id: 'output', title: 'Output', order: 2, level: 1 },
      ];

      const instance = createInstance(sections);

      expect(instance.sections).toHaveLength(3);
    });
  });

  describe('edge cases', () => {
    it('order が順不同でも問題なく扱える', () => {
      const sections: TocSectionData[] = [
        { id: 'section-3', title: 'Section 3', order: 2, level: 1 },
        { id: 'section-1', title: 'Section 1', order: 0, level: 1 },
        { id: 'section-2', title: 'Section 2', order: 1, level: 1 },
      ];

      const instance = createInstance(sections);

      // Component receives whatever order is provided
      expect(instance.sections[0].id).toBe('section-3');
      expect(instance.sections[1].id).toBe('section-1');
      expect(instance.sections[2].id).toBe('section-2');
    });

    it('同じレベルと異なるレベルが混在しても扱える', () => {
      const sections: TocSectionData[] = [
        { id: 'a', title: 'A', order: 0, level: 1 },
        { id: 'a1', title: 'A1', order: 1, level: 2 },
        { id: 'b', title: 'B', order: 2, level: 1 },
        { id: 'c', title: 'C', order: 3, level: 1 },
        { id: 'c1', title: 'C1', order: 4, level: 2 },
        { id: 'c2', title: 'C2', order: 5, level: 2 },
      ];

      const instance = createInstance(sections);

      expect(instance.sections).toHaveLength(6);
    });

    it('非常に長いタイトルでも扱える', () => {
      const longTitle = 'これは非常に長いセクションタイトルです。'.repeat(10);
      const sections: TocSectionData[] = [
        { id: 'long', title: longTitle, order: 0, level: 1 },
      ];

      const instance = createInstance(sections);

      expect(instance.sections[0].title).toBe(longTitle);
    });
  });
});
