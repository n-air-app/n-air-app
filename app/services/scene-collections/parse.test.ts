import { IParseWarning, parse } from './parse';

jest.mock('electron', () => ({}));
jest.mock('@electron/remote', () => ({}));

type IFakeSchema = Record<string, unknown>;

// Minimal stand-ins for real Node subclasses, just enough to exercise
// parse()'s reviver logic without pulling in the DI container.
class FakeNode {
  schemaVersion = 2;
  data: IFakeSchema;

  fromJSON(obj: IFakeSchema) {
    const clone = { ...obj };
    delete clone.schemaVersion;
    delete clone.nodeType;
    this.data = clone;
  }
}

class FakeArrayNode {
  schemaVersion = 1;
  data: IFakeSchema;

  fromJSON(obj: IFakeSchema) {
    const clone = { ...obj };
    delete clone.schemaVersion;
    delete clone.nodeType;
    this.data = clone;
  }
}

const NODE_TYPES: Dictionary<typeof FakeNode | typeof FakeArrayNode> = {
  FakeNode,
  FakeArrayNode,
};

describe('parse', () => {
  test('parses a well-formed collection with no warnings', () => {
    const warnings: IParseWarning[] = [];
    const config = JSON.stringify({
      schemaVersion: 2,
      nodeType: 'FakeNode',
      value: 'hello',
    });

    const result = parse(config, NODE_TYPES, (w) => warnings.push(w));

    expect(warnings).toEqual([]);
    expect(result).toBeInstanceOf(FakeNode);
    expect(result.data).toEqual({ value: 'hello' });
  });

  test('skips an unknown nodeType at object position and reports a warning', () => {
    const warnings: IParseWarning[] = [];
    const config = JSON.stringify({
      schemaVersion: 2,
      nodeType: 'FakeNode',
      unknownChild: {
        schemaVersion: 1,
        nodeType: 'SomeFutureNode',
        value: 'from the future',
      },
      known: 'still here',
    });

    const result = parse(config, NODE_TYPES, (w) => warnings.push(w));

    expect(warnings).toEqual([{ kind: 'unknownNodeType', nodeType: 'SomeFutureNode' }]);
    // The unknown child's key is dropped entirely, everything else survives
    expect(result.data.unknownChild).toBeUndefined();
    expect(result.data.known).toBe('still here');
  });

  test('leaves a hole (not a throw) for an unknown nodeType inside an array', () => {
    const warnings: IParseWarning[] = [];
    const config = JSON.stringify({
      schemaVersion: 1,
      nodeType: 'FakeArrayNode',
      items: [
        { schemaVersion: 2, nodeType: 'FakeNode', value: 'a' },
        { schemaVersion: 1, nodeType: 'SomeFutureNode', value: 'b' },
        { schemaVersion: 2, nodeType: 'FakeNode', value: 'c' },
      ],
    });

    const result = parse(config, NODE_TYPES, (w) => warnings.push(w));

    expect(warnings).toEqual([{ kind: 'unknownNodeType', nodeType: 'SomeFutureNode' }]);
    expect(result.data.items).toHaveLength(3);
    expect(result.data.items[0]).toBeInstanceOf(FakeNode);
    expect(result.data.items[1]).toBeUndefined(); // the hole
    expect(result.data.items[2]).toBeInstanceOf(FakeNode);
  });

  test('does not throw when no onWarn callback is given for an unknown nodeType', () => {
    const config = JSON.stringify({
      schemaVersion: 1,
      nodeType: 'SomeFutureNode',
      value: 'x',
    });

    expect(() => parse(config, NODE_TYPES)).not.toThrow();
    expect(parse(config, NODE_TYPES)).toBeUndefined();
  });

  test('reports schemaVersionTooNew but still constructs the node (best-effort)', () => {
    const warnings: IParseWarning[] = [];
    const config = JSON.stringify({
      schemaVersion: 99,
      nodeType: 'FakeNode',
      value: 'from a much newer app',
    });

    const result = parse(config, NODE_TYPES, (w) => warnings.push(w));

    expect(warnings).toEqual([
      { kind: 'schemaVersionTooNew', nodeType: 'FakeNode', schemaVersion: 99, maxKnownVersion: 2 },
    ]);
    expect(result).toBeInstanceOf(FakeNode);
    expect(result.data.value).toBe('from a much newer app');
  });

  test('does not warn when schemaVersion is at or below the supported version', () => {
    const warnings: IParseWarning[] = [];
    const config = JSON.stringify({
      schemaVersion: 2,
      nodeType: 'FakeNode',
      value: 'ok',
    });

    parse(config, NODE_TYPES, (w) => warnings.push(w));

    expect(warnings).toEqual([]);
  });

  test('ignores deprecated node types without warning', () => {
    const warnings: IParseWarning[] = [];
    const config = JSON.stringify({
      schemaVersion: 1,
      nodeType: 'FiltersNode',
      value: 'legacy',
    });

    const result = parse(config, NODE_TYPES, (w) => warnings.push(w));

    expect(warnings).toEqual([]);
    expect(result).toEqual({
      schemaVersion: 1,
      nodeType: 'FiltersNode',
      value: 'legacy',
    });
  });
});
