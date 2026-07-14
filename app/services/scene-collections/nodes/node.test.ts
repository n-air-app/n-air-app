import { ILoadError, Node } from './node';

jest.mock('electron', () => ({}));
jest.mock('@electron/remote', () => ({}));

// Test implementation of abstract Node class
class TestNode extends Node<{ value: string }, {}> {
  schemaVersion = 1;

  async save(context: {}): Promise<void> {
    this.data = { value: 'test' };
  }

  async load(context: {}): Promise<void> {
    // Simulate loading with potential errors
  }
}

describe('Node error collection', () => {
  let node: TestNode;

  beforeEach(() => {
    node = new TestNode();
  });

  test('should initialize with empty error array', () => {
    expect(node.getLoadErrors()).toEqual([]);
  });

  test('should add load error', () => {
    const error: ILoadError = {
      type: 'source',
      id: 'test-id',
      name: 'Test Source',
      error: new Error('Test error'),
    };

    node['addLoadError'](error);

    const errors = node.getLoadErrors();
    expect(errors).toHaveLength(1);
    expect(errors[0]).toEqual(error);
  });

  test('should accumulate multiple errors', () => {
    const error1: ILoadError = {
      type: 'source',
      name: 'Source 1',
      error: new Error('Error 1'),
    };

    const error2: ILoadError = {
      type: 'scene',
      name: 'Scene 1',
      error: new Error('Error 2'),
    };

    node['addLoadError'](error1);
    node['addLoadError'](error2);

    const errors = node.getLoadErrors();
    expect(errors).toHaveLength(2);
    expect(errors[0]).toEqual(error1);
    expect(errors[1]).toEqual(error2);
  });

  test('should clear load errors', () => {
    const error: ILoadError = {
      type: 'source',
      name: 'Test Source',
      error: new Error('Test error'),
    };

    node['addLoadError'](error);
    expect(node.getLoadErrors()).toHaveLength(1);

    node.clearLoadErrors();
    expect(node.getLoadErrors()).toEqual([]);
  });

  test('should support all error types', () => {
    const errorTypes: ILoadError['type'][] = [
      'source',
      'scene',
      'sceneItem',
      'transition',
      'hotkey',
      'filter',
      'format',
    ];

    errorTypes.forEach((type) => {
      const error: ILoadError = {
        type,
        name: `Test ${type}`,
        error: new Error(`${type} error`),
      };
      node['addLoadError'](error);
    });

    const errors = node.getLoadErrors();
    expect(errors).toHaveLength(errorTypes.length);
    errorTypes.forEach((type, index) => {
      expect(errors[index].type).toBe(type);
    });
  });
});
