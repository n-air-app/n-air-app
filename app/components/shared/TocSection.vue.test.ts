import { jest_fn } from 'util/jest_fn';

// Mock Vue
jest.mock('vue', () => ({
  __esModule: true,
  default: class Vue {
    $nextTick(fn: () => void) {
      Promise.resolve().then(fn);
    }
  },
}));

jest.mock('vue-property-decorator', () => ({
  Component: (options?: any) => (target: any) => {
    if (options?.inject) {
      // Store inject configuration for later use in tests
      target.prototype._injectConfig = options.inject;
    }
    if (options?.provide) {
      target.prototype._provideFunction = options.provide;
    }
    return target;
  },
  Prop: (options?: any) => (target: any, propertyKey: string) => {},
}));

describe('TocSection', () => {
  let TocSection: any;
  let mockGetTocSectionId: jest.Mock;
  let mockRegisterTocSection: jest.Mock;
  let mockUnregisterTocSection: jest.Mock;
  let sectionIdCounter: number;

  beforeEach(() => {
    jest.resetModules();

    sectionIdCounter = 0;
    mockGetTocSectionId = jest_fn()
      .mockName('getTocSectionId')
      .mockImplementation(() => `toc-section-${sectionIdCounter++}`);
    mockRegisterTocSection = jest_fn()
      .mockName('registerTocSection')
      .mockReturnValue('TestCategory'); // Return category name
    mockUnregisterTocSection = jest_fn().mockName('unregisterTocSection');

    TocSection = require('./TocSection.vue.ts').default;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  function createInstance(props: {
    title: string;
    id?: string;
    level?: number;
    visible?: boolean;
    parentTocLevel?: number;
  }): any {
    const instance = new TocSection();

    // Set props
    instance.title = props.title;
    instance.id = props.id;
    instance.level = props.level;
    instance.visible = props.visible !== undefined ? props.visible : true;

    // Set injected functions
    instance.getTocSectionId = mockGetTocSectionId;
    instance.registerTocSection = mockRegisterTocSection;
    instance.unregisterTocSection = mockUnregisterTocSection;
    instance.parentTocLevel = props.parentTocLevel;

    return instance;
  }

  describe('sectionId', () => {
    it('id prop が指定されている場合はそれを使う', () => {
      const instance = createInstance({
        title: 'テストセクション',
        id: 'custom-id',
      });

      expect(instance.sectionId).toBe('custom-id');
      expect(mockGetTocSectionId).not.toHaveBeenCalled();
    });

    it('id prop がない場合はカウンターベースのIDを生成する', () => {
      const instance = createInstance({
        title: 'Test Section',
      });

      expect(instance.sectionId).toBe('toc-section-0');
      expect(mockGetTocSectionId).toHaveBeenCalledTimes(1);
    });

    it('複数のインスタンスで一意のIDが生成される', () => {
      const instance1 = createInstance({
        title: 'Section 1',
      });
      const instance2 = createInstance({
        title: 'Section 2',
      });
      const instance3 = createInstance({
        title: 'Section 3',
      });

      expect(instance1.sectionId).toBe('toc-section-0');
      expect(instance2.sectionId).toBe('toc-section-1');
      expect(instance3.sectionId).toBe('toc-section-2');
      expect(mockGetTocSectionId).toHaveBeenCalledTimes(3);
    });

    it('同じタイトルでも異なるIDが生成される', () => {
      const instance1 = createInstance({
        title: '表示設定',
      });
      const instance2 = createInstance({
        title: '表示設定',
      });

      expect(instance1.sectionId).toBe('toc-section-0');
      expect(instance2.sectionId).toBe('toc-section-1');
      expect(instance1.sectionId).not.toBe(instance2.sectionId);
    });

    it('sectionId は一度生成されたらキャッシュされる', () => {
      const instance = createInstance({
        title: 'Test',
      });

      const id1 = instance.sectionId;
      const id2 = instance.sectionId;
      const id3 = instance.sectionId;

      expect(id1).toBe(id2);
      expect(id2).toBe(id3);
      expect(mockGetTocSectionId).toHaveBeenCalledTimes(1);
    });

    it('日本語タイトルでもIDは機械的に生成される', () => {
      const instance = createInstance({
        title: 'N Voice 琴詠ニア',
      });

      expect(instance.sectionId).toBe('toc-section-0');
    });
  });

  describe('computedLevel', () => {
    it('level prop が指定されている場合はそれを使う', () => {
      const instance = createInstance({
        title: 'Test',
        level: 2,
      });

      expect(instance.computedLevel).toBe(2);
    });

    it('親の TocSection がある場合は親の level + 1', () => {
      const instance = createInstance({
        title: 'Test',
        parentTocLevel: 1,
      });

      expect(instance.computedLevel).toBe(2);
    });

    it('親もなく level も指定されていない場合はデフォルトで 1', () => {
      const instance = createInstance({
        title: 'Test',
      });

      expect(instance.computedLevel).toBe(1);
    });

    it('level prop が指定されている場合は親の level より優先される', () => {
      const instance = createInstance({
        title: 'Test',
        level: 3,
        parentTocLevel: 1,
      });

      expect(instance.computedLevel).toBe(3);
    });
  });

  describe('mounted', () => {
    it('visible が true の場合、$nextTick 後に registerTocSection が呼ばれる', async () => {
      const instance = createInstance({
        title: 'Test Section',
        visible: true,
      });

      await instance.mounted();
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockRegisterTocSection).toHaveBeenCalledWith({
        id: 'toc-section-0',
        title: 'Test Section',
        order: 0,
        level: 1,
      });
    });

    it('visible が false の場合、registerTocSection は呼ばれない', async () => {
      const instance = createInstance({
        title: 'Test Section',
        visible: false,
      });

      await instance.mounted();
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockRegisterTocSection).not.toHaveBeenCalled();
    });

    it('computedLevel が正しく登録される', async () => {
      const instance = createInstance({
        title: 'Nested Section',
        parentTocLevel: 1,
      });

      await instance.mounted();
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockRegisterTocSection).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 2,
        }),
      );
    });

    it('registerTocSection が undefined の場合でもエラーにならない', async () => {
      const instance = createInstance({
        title: 'Test',
      });
      instance.registerTocSection = undefined;

      expect(() => instance.mounted()).not.toThrow();
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    it('registerTocSection が関数でない場合でもエラーにならない', async () => {
      const instance = createInstance({
        title: 'Test',
      });
      instance.registerTocSection = 'not a function' as any;

      expect(() => instance.mounted()).not.toThrow();
      await new Promise(resolve => setTimeout(resolve, 0));
    });
  });

  describe('beforeDestroy', () => {
    it('unregisterTocSection が呼ばれる（明示的なID）', async () => {
      const instance = createInstance({
        title: 'Test Section',
        id: 'test-id',
      });

      // mounted を呼び出して登録（非同期）
      instance.mounted();
      await new Promise(resolve => setImmediate(resolve)); // Wait for $nextTick

      instance.beforeDestroy();

      expect(mockUnregisterTocSection).toHaveBeenCalledWith('TestCategory', 'test-id');
    });

    it('unregisterTocSection が生成されたIDで呼ばれる', async () => {
      const instance = createInstance({
        title: 'Test Section',
      });

      // sectionId を先に取得して ID を生成
      const generatedId = instance.sectionId;

      // mounted を呼び出して登録（非同期）
      instance.mounted();
      await new Promise(resolve => setImmediate(resolve)); // Wait for $nextTick

      instance.beforeDestroy();

      expect(mockUnregisterTocSection).toHaveBeenCalledWith('TestCategory', generatedId);
      expect(mockUnregisterTocSection).toHaveBeenCalledWith('TestCategory', 'toc-section-0');
    });
  });
});
