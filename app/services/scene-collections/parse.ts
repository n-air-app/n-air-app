// These nodes will not be created as nodes
const deprecatedNodes = ['FiltersNode'];

/**
 * A warning about a structural forward-compatibility issue encountered
 * while parsing a scene collection: either a nodeType this version of the
 * app doesn't know about (added by a newer version), or a schemaVersion
 * higher than what this version supports. Neither case throws; the
 * offending piece of data is skipped (unknown nodeType) or loaded
 * best-effort (schemaVersion too new), and reported via this callback so
 * the caller can surface it as a load warning instead of a hard failure.
 */
export type IParseWarning =
  | { kind: 'unknownNodeType'; nodeType: string }
  | { kind: 'schemaVersionTooNew'; nodeType: string; schemaVersion: number; maxKnownVersion: number };

export function parse(
  config: string,
  nodeTypes: Dictionary<any>,
  onWarn?: (warning: IParseWarning) => void,
) {
  return JSON.parse(config, (key, value) => {
    if (
      typeof value === 'object'
      && value !== null
      && value.nodeType
      && !deprecatedNodes.includes(value.nodeType)
    ) {
      const NodeCtor = nodeTypes[value.nodeType];

      // Unknown nodeType: this data was written by a newer version of the
      // app that added a node type we don't know about. Skip it instead of
      // throwing, so the rest of the collection can still load.
      if (typeof NodeCtor !== 'function') {
        onWarn?.({ kind: 'unknownNodeType', nodeType: value.nodeType });
        return undefined;
      }

      const instance = new NodeCtor();

      // Known nodeType, but its schemaVersion is higher than what this
      // node class supports: the data may contain a structural change we
      // don't understand. Don't throw; load it best-effort (migrate()'s
      // `if (version < N)` checks simply won't fire) and report a warning.
      if (
        typeof value.schemaVersion === 'number'
        && value.schemaVersion > instance.schemaVersion
      ) {
        onWarn?.({
          kind: 'schemaVersionTooNew',
          nodeType: value.nodeType,
          schemaVersion: value.schemaVersion,
          maxKnownVersion: instance.schemaVersion,
        });
      }

      instance.fromJSON(value);
      return instance;
    }

    return value;
  });
}
