import { ArrayNode } from './array-node';

jest.mock('electron', () => ({}));
jest.mock('@electron/remote', () => ({}));

interface ITestItemSchema {
  id: string;
  name: string;
  shouldFail?: boolean;
}

interface ITestItem {
  id: string;
  name: string;
}

// Test implementation of abstract ArrayNode class
class TestArrayNode extends ArrayNode<ITestItemSchema, {}, ITestItem> {
  schemaVersion = 1;
  private items: ITestItem[] = [];

  setItems(items: ITestItem[]) {
    this.items = items;
  }

  getItems(context: {}): ITestItem[] {
    return this.items;
  }

  async saveItem(item: ITestItem, context: {}): Promise<ITestItemSchema> {
    return {
      id: item.id,
      name: item.name,
    };
  }

  async loadItem(item: ITestItemSchema, context: {}): Promise<void> {
    if (item.shouldFail) {
      throw new Error(`Failed to load item: ${item.name}`);
    }
    this.items.push({ id: item.id, name: item.name });
  }

  protected getItemInfo(item: ITestItemSchema): { type: any; id?: string; name: string } {
    return {
      type: 'sceneItem',
      id: item.id,
      name: item.name,
    };
  }
}

describe('ArrayNode error collection', () => {
  let node: TestArrayNode;

  beforeEach(() => {
    node = new TestArrayNode();
  });

  test('should load all items successfully when no errors', async () => {
    node.data = {
      items: [
        { id: '1', name: 'Item 1' },
        { id: '2', name: 'Item 2' },
        { id: '3', name: 'Item 3' },
      ],
    };

    await node.load({});

    expect(node.getLoadErrors()).toEqual([]);
    expect(node.getItems({})).toHaveLength(3);
  });

  test('should collect errors when items fail to load', async () => {
    node.data = {
      items: [
        { id: '1', name: 'Item 1' },
        { id: '2', name: 'Item 2', shouldFail: true },
        { id: '3', name: 'Item 3' },
        { id: '4', name: 'Item 4', shouldFail: true },
      ],
    };

    await node.load({});

    const errors = node.getLoadErrors();
    expect(errors).toHaveLength(2);
    expect(errors[0].name).toBe('Item 2');
    expect(errors[0].id).toBe('2');
    expect(errors[0].type).toBe('sceneItem');
    expect(errors[1].name).toBe('Item 4');
    expect(errors[1].id).toBe('4');

    // Successfully loaded items should still be present
    expect(node.getItems({})).toHaveLength(2);
  });

  test('should continue loading after encountering error', async () => {
    node.data = {
      items: [
        { id: '1', name: 'Item 1', shouldFail: true },
        { id: '2', name: 'Item 2' },
        { id: '3', name: 'Item 3' },
      ],
    };

    await node.load({});

    expect(node.getLoadErrors()).toHaveLength(1);
    expect(node.getItems({})).toHaveLength(2);
    expect(node.getItems({})[0].name).toBe('Item 2');
    expect(node.getItems({})[1].name).toBe('Item 3');
  });

  test('should clear errors on subsequent load', async () => {
    // First load with errors
    node.data = {
      items: [{ id: '1', name: 'Item 1', shouldFail: true }],
    };
    await node.load({});
    expect(node.getLoadErrors()).toHaveLength(1);

    // Second load without errors
    node.data = {
      items: [{ id: '2', name: 'Item 2' }],
    };
    await node.load({});
    expect(node.getLoadErrors()).toEqual([]);
  });

  test('should handle empty items array', async () => {
    node.data = { items: [] };
    await node.load({});
    expect(node.getLoadErrors()).toEqual([]);
    expect(node.getItems({})).toHaveLength(0);
  });

  test('should handle undefined items', async () => {
    node.data = { items: undefined as any };
    await node.load({});
    expect(node.getLoadErrors()).toEqual([]);
  });

  test('should skip null/undefined holes left by parse() skipping an unknown nodeType, and report them', async () => {
    // parse() leaves holes as null/undefined in the array; TSchema itself
    // never legitimately contains them, so the array element type is
    // widened here rather than typing ITestItemSchema as nullable.
    const items: (ITestItemSchema | null | undefined)[] = [
      { id: '1', name: 'Item 1' },
      null,
      { id: '2', name: 'Item 2' },
      undefined,
    ];
    node.data = { items: items as ITestItemSchema[] };

    await node.load({});

    // The holes are dropped before loadItem()/beforeLoad() ever see them,
    // but reported as a single 'format' load error rather than silently
    // (a stray null unrelated to a parse-time skip should still be
    // visible to the user).
    const errors = node.getLoadErrors();
    expect(errors).toHaveLength(1);
    expect(errors[0].type).toBe('format');
    // The reported name identifies which node class dropped items, so the
    // partial-load warning dialog doesn't show an unattributed "2
    // unrecognized item(s)" line when multiple node types are affected.
    expect(errors[0].name).toContain('TestArrayNode');
    expect(errors[0].name).toContain('2');
    expect(node.getItems({})).toHaveLength(2);
    expect(node.getItems({})[0].name).toBe('Item 1');
    expect(node.getItems({})[1].name).toBe('Item 2');
  });
});
