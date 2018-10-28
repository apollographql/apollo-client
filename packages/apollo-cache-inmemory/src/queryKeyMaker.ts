import { CacheKeyNode } from "./optimism";
import { DocumentNode, SelectionSetNode, FragmentSpreadNode, FragmentDefinitionNode } from "graphql";
import { QueryDocumentKeys } from "graphql/language/visitor";

const CIRCULAR = Object.create(null);
const objToStr = Object.prototype.toString;

export class QueryKeyMaker {
  private perQueryKeyMakers = new Map<DocumentNode, PerQueryKeyMaker>();

  constructor(private cacheKeyRoot: CacheKeyNode) {}

  public forQuery(document: DocumentNode) {
    if (! this.perQueryKeyMakers.has(document)) {
      this.perQueryKeyMakers.set(
        document,
        new PerQueryKeyMaker(this.cacheKeyRoot, document),
      );
    }
    return this.perQueryKeyMakers.get(document);
  }
}

class PerQueryKeyMaker {
  private cache = new Map;

  constructor(
    private cacheKeyRoot: CacheKeyNode,
    private query: DocumentNode,
  ) {
    this.lookupArray = this.cacheMethod(this.lookupArray);
    this.lookupObject = this.cacheMethod(this.lookupObject);
    this.lookupFragmentSpread = this.cacheMethod(this.lookupFragmentSpread);
  }

  private cacheMethod<V, R>(method: (value: V) => R): typeof method {
    return (value: V) => {
      if (this.cache.has(value)) {
        const cached = this.cache.get(value);
        if (cached === CIRCULAR) {
          throw new Error("QueryKeyMaker cannot handle circular query structures");
        }
        return cached;
      }
      this.cache.set(value, CIRCULAR);
      try {
        const result = method.call(this, value);
        this.cache.set(value, result);
        return result;
      } catch (e) {
        this.cache.delete(value);
        throw e;
      }
    };
  }

  public lookupQuery(document: DocumentNode): object {
    return this.lookupObject(document);
  }

  public lookupSelectionSet(selectionSet: SelectionSetNode) {
    return this.lookupObject(selectionSet);
  }

  private lookupFragmentSpread(fragmentSpread: FragmentSpreadNode): object {
    const name = fragmentSpread.name.value;
    let fragment: FragmentDefinitionNode = null;

    this.query.definitions.some(definition => {
      if (definition.kind === "FragmentDefinition" &&
          definition.name.value === name) {
        fragment = definition;
        return true;
      }
    });

    // Include the key object computed from the FragmentDefinition named by
    // this FragmentSpreadNode.
    return this.lookupObject({
      ...fragmentSpread,
      fragment,
    });
  }

  private lookupAny(value: any): object {
    if (Array.isArray(value)) {
      return this.lookupArray(value);
    }

    if (typeof value === "object" && value !== null) {
      if (value.kind === "FragmentSpread") {
        return this.lookupFragmentSpread(value);
      }
      return this.lookupObject(value);
    }

    return value;
  }

  private lookupArray(array: any[]): object {
    const elements = array.map(this.lookupAny, this);
    return this.cacheKeyRoot.lookup(
      objToStr.call(array),
      this.cacheKeyRoot.lookupArray(elements),
    );
  }

  private lookupObject(object: { [key: string]: any }): object {
    const keys = safeSortedKeys(object);
    const values = keys.map(key => this.lookupAny(object[key]));
    return this.cacheKeyRoot.lookup(
      objToStr.call(object),
      this.cacheKeyRoot.lookupArray(keys),
      this.cacheKeyRoot.lookupArray(values),
    );
  }
}

const queryKeyMap: {
  [key: string]: { [key: string]: boolean }
} = Object.create(null);

Object.keys(QueryDocumentKeys).forEach(parentKind => {
  const childKeys = queryKeyMap[parentKind] = Object.create(null);

  (QueryDocumentKeys as {
    [key: string]: any[]
  })[parentKind].forEach(childKey => {
    childKeys[childKey] = true;
  });

  if (parentKind === "FragmentSpread") {
    // A custom key that we include when looking up FragmentSpread nodes.
    childKeys["fragment"] = true;
  }
});

function safeSortedKeys(object: { [key: string]: any }): string[] {
  const keys = Object.keys(object);
  const keyCount = keys.length;
  const knownKeys = typeof object.kind === "string" && queryKeyMap[object.kind];

  // Remove unknown object-valued keys from the array, but leave keys with
  // non-object values untouched.
  let target = 0;
  for (let source = target; source < keyCount; ++source) {
    const key = keys[source];
    const value = object[key];
    const isObjectOrArray = value !== null && typeof value === "object";
    if (! isObjectOrArray || ! knownKeys || knownKeys[key] === true) {
      keys[target++] = key;
    }
  }
  keys.length = target;

  return keys.sort();
}
