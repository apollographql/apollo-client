import { SelectionSetNode, FieldNode, DocumentNode } from 'graphql';
import { invariant, InvariantError } from 'ts-invariant';

import {
  createFragmentMap,
  FragmentMap,
  getFragmentFromSelection,
} from '../../utilities/graphql/fragments';

import {
  getDefaultValues,
  getFragmentDefinitions,
  getOperationDefinition,
} from '../../utilities/graphql/getFromAST';

import {
  getTypenameFromResult,
  makeReference,
  isReference,
  isField,
  resultKeyNameFromField,
  StoreValue,
} from '../../utilities/graphql/storeUtils';

import {
  DeepMerger,
  ReconcilerFunction,
} from '../../utilities/common/mergeDeep';

import { shouldInclude } from '../../utilities/graphql/directives';
import { cloneDeep } from '../../utilities/common/cloneDeep';

import { defaultNormalizedCacheFactory } from './entityCache';
import { NormalizedCache, StoreObject } from './types';
import { getTypenameFromStoreObject } from './helpers';
import { Policies, StoreValueMergeFunction } from './policies';

export type WriteContext = {
  readonly store: NormalizedCache;
  readonly written: {
    [dataId: string]: SelectionSetNode[];
  };
  readonly mergeFields: StoreObjectMergeFunction;
  readonly mergeStoreObjects: StoreObjectMergeFunction;
  readonly variables?: any;
  readonly fragmentMap?: FragmentMap;
};

type StoreObjectMergeFunction = (
  existing: StoreObject,
  incoming: StoreObject,
  overrides?: MergeOverrides,
) => StoreObject;

type MergeOverrides = Record<string, {
  merge?: StoreValueMergeFunction;
  child?: MergeOverrides;
}>;

export interface StoreWriterConfig {
  policies: Policies;
};

export class StoreWriter {
  private policies: Policies;

  constructor(config: StoreWriterConfig) {
    this.policies = config.policies;
  }

  /**
   * Writes the result of a query to the store.
   *
   * @param result The result object returned for the query document.
   *
   * @param query The query document whose result we are writing to the store.
   *
   * @param store The {@link NormalizedCache} used by Apollo for the `data` portion of the store.
   *
   * @param variables A map from the name of a variable to its value. These variables can be
   * referenced by the query document.
   */
  public writeQueryToStore({
    query,
    result,
    dataId = 'ROOT_QUERY',
    store = defaultNormalizedCacheFactory(),
    variables,
  }: {
    query: DocumentNode;
    result: Object;
    dataId?: string;
    store?: NormalizedCache;
    variables?: Object;
  }): NormalizedCache {
    const operationDefinition = getOperationDefinition(query)!;

    // Any IDs written explicitly to the cache (including ROOT_QUERY, most
    // frequently) will be retained as reachable root IDs on behalf of their
    // owner DocumentNode objects, until/unless evicted for all owners.
    store.retain(dataId);

    // A DeepMerger that merges arrays and objects structurally, but otherwise
    // prefers incoming scalar values over existing values. Used to accumulate
    // fields when processing a single selection set.
    const simpleFieldsMerger = new DeepMerger;

    // A DeepMerger used for updating normalized StoreObjects in the store,
    // with special awareness of { __ref } objects, arrays, and custom logic
    // for reading and writing field values.
    const storeObjectMerger = new DeepMerger(storeObjectReconciler);

    return this.writeSelectionSetToStore({
      result: result || Object.create(null),
      dataId,
      selectionSet: operationDefinition.selectionSet,
      context: {
        store,
        written: Object.create(null),
        mergeFields(existing, incoming) {
          return simpleFieldsMerger.merge(existing, incoming);
        },
        mergeStoreObjects(existing, incoming, overrides) {
          return storeObjectMerger.merge(existing, incoming, store, overrides);
        },
        variables: {
          ...getDefaultValues(operationDefinition),
          ...variables,
        },
        fragmentMap: createFragmentMap(getFragmentDefinitions(query)),
      },
    });
  }

  private writeSelectionSetToStore({
    dataId,
    result,
    selectionSet,
    context,
  }: {
    dataId: string;
    result: Record<string, any>;
    selectionSet: SelectionSetNode;
    context: WriteContext;
  }): NormalizedCache {
    const { store, written } = context;

    // Avoid processing the same entity object using the same selection set
    // more than once. We use an array instead of a Set since most entity IDs
    // will be written using only one selection set, so the size of this array
    // is likely to be very small, meaning indexOf is likely to be faster than
    // Set.prototype.has.
    const sets = written[dataId] || (written[dataId] = []);
    if (sets.indexOf(selectionSet) >= 0) return store;
    sets.push(selectionSet);

    const processed = this.processSelectionSet({
      result,
      selectionSet,
      context,
      typename: this.policies.rootTypenamesById[dataId],
    });

    const existing: StoreObject = store.get(dataId) || Object.create(null);

    if (processed.mergeOverrides) {
      // If processSelectionSet reported any custom merge functions, walk
      // the processed.mergeOverrides structure and preemptively merge
      // incoming values with (possibly non-existent) existing values
      // using the custom function. This function updates processed.result
      // in place with the custom-merged values.
      walkWithMergeOverrides(
        existing,
        processed.result,
        processed.mergeOverrides,
      );
    }

    store.set(
      dataId,
      context.mergeStoreObjects(
        existing,
        processed.result,
        // To avoid re-merging values that have already been merged by
        // custom merge functions, give context.mergeStoreObjects access
        // to the mergeOverrides information that was used above.
        processed.mergeOverrides,
      ),
    );

    return store;
  }

  private processSelectionSet({
    result,
    selectionSet,
    context,
    mergeOverrides,
    typename = getTypenameFromResult(
      result, selectionSet, context.fragmentMap),
  }: {
    result: Record<string, any>;
    selectionSet: SelectionSetNode;
    context: WriteContext;
    mergeOverrides?: MergeOverrides;
    typename?: string;
  }): {
    result: StoreObject;
    mergeOverrides?: MergeOverrides;
  } {
    let mergedFields: StoreObject = Object.create(null);
    if (typeof typename === "string") {
      mergedFields.__typename = typename;
    }

    selectionSet.selections.forEach(selection => {
      if (!shouldInclude(selection, context.variables)) {
        return;
      }

      if (isField(selection)) {
        const resultFieldKey = resultKeyNameFromField(selection);
        const value = result[resultFieldKey];

        if (typeof value !== 'undefined') {
          const storeFieldName = this.policies.getStoreFieldName(
            typename,
            selection,
            context.variables,
          );

          const processed = this.processFieldValue(value, selection, context);

          const merge = this.policies.getFieldMergeFunction(
            typename,
            selection,
            context.variables,
          );

          if (merge || processed.mergeOverrides) {
            mergeOverrides = mergeOverrides || Object.create(null);
            mergeOverrides[storeFieldName] = context.mergeFields(
              mergeOverrides[storeFieldName],
              { merge, child: processed.mergeOverrides },
            ) as MergeOverrides[string];
          }

          mergedFields = context.mergeFields(mergedFields, {
            [storeFieldName]: processed.result,
          });

        } else if (
          this.policies.usingPossibleTypes &&
          !(
            selection.directives &&
            selection.directives.some(
              ({ name }) =>
                name && (name.value === 'defer' || name.value === 'client'),
            )
          )
        ) {
          // XXX We'd like to throw an error, but for backwards compatibility's sake
          // we just print a warning for the time being.
          //throw new WriteError(`Missing field ${resultFieldKey} in ${JSON.stringify(result, null, 2).substring(0, 100)}`);
          invariant.warn(
            `Missing field ${resultFieldKey} in ${JSON.stringify(
              result,
              null,
              2,
            ).substring(0, 100)}`,
          );
        }
      } else {
        // This is not a field, so it must be a fragment, either inline or named
        const fragment = getFragmentFromSelection(
          selection,
          context.fragmentMap,
        );

        if (this.policies.fragmentMatches(fragment, typename)) {
          mergedFields = context.mergeFields(
            mergedFields,
            this.processSelectionSet({
              result,
              selectionSet: fragment.selectionSet,
              context,
              mergeOverrides,
              typename,
            }).result,
          );
        }
      }
    });

    return {
      result: mergedFields,
      mergeOverrides,
    };
  }

  private processFieldValue(
    value: any,
    field: FieldNode,
    context: WriteContext,
  ): {
    result: StoreValue;
    mergeOverrides?: MergeOverrides;
  } {
    if (!field.selectionSet || value === null) {
      // In development, we need to clone scalar values so that they can be
      // safely frozen with maybeDeepFreeze in readFromStore.ts. In production,
      // it's cheaper to store the scalar values directly in the cache.
      return {
        result: process.env.NODE_ENV === 'production' ? value : cloneDeep(value),
      };
    }

    if (Array.isArray(value)) {
      let overrides: Record<number, MergeOverrides>;
      const result = value.map((item, i) => {
        const { result, mergeOverrides } =
          this.processFieldValue(item, field, context);
        if (mergeOverrides) {
          overrides = overrides || [];
          overrides[i] = mergeOverrides;
        }
        return result;
      });
      return { result, mergeOverrides: overrides };
    }

    if (value) {
      const dataId = this.policies.identify(
        value,
        // Since value is a result object rather than a normalized StoreObject,
        // we need to consider aliases when computing its key fields.
        field.selectionSet,
        context.fragmentMap,
      );

      if (typeof dataId === 'string') {
        this.writeSelectionSetToStore({
          dataId,
          result: value,
          selectionSet: field.selectionSet,
          context,
        });
        return { result: makeReference(dataId) };
      }
    }

    return this.processSelectionSet({
      result: value,
      selectionSet: field.selectionSet,
      context,
    });
  }
}

function walkWithMergeOverrides(
  existingObject: StoreObject,
  incomingObject: StoreObject,
  overrides: MergeOverrides,
): void {
  Object.keys(overrides).forEach(name => {
    const { merge, child } = overrides[name];
    const existingValue: any = existingObject && existingObject[name];
    const incomingValue: any = incomingObject && incomingObject[name];
    if (child) {
      // StoreObjects can have multiple layers of child objects/arrays,
      // each layer with its own child fields and override functions.
      walkWithMergeOverrides(existingValue, incomingValue, child);
    }
    if (merge) {
      incomingObject[name] = merge(existingValue, incomingValue, existingObject);
    }
  });
}

const storeObjectReconciler: ReconcilerFunction<[
  NormalizedCache,
  MergeOverrides | undefined,
]> = function (
  existingObject,
  incomingObject,
  property,
  // This parameter comes from the additional argument we pass to the
  // merge method in context.mergeStoreObjects (see writeQueryToStore).
  store,
  mergeOverrides,
) {
  // In the future, reconciliation logic may depend on the type of the parent
  // StoreObject, not just the values of the given property.
  const existing = existingObject[property];
  const incoming = incomingObject[property];

  const mergeChildObj = mergeOverrides && mergeOverrides[property];
  if (mergeChildObj && typeof mergeChildObj.merge === "function") {
    // If this property was overridden by a custom merge function, then
    // its merged value has already been determined, so we should return
    // incoming without recursively merging it into existing.
    return incoming;
  }

  if (
    existing !== incoming &&
    // The DeepMerger class has various helpful utilities that we might as
    // well reuse here.
    this.isObject(existing) &&
    this.isObject(incoming)
  ) {
    const eType = getTypenameFromStoreObject(store, existing);
    const iType = getTypenameFromStoreObject(store, incoming);
    // If both objects have a typename and the typename is different, let the
    // incoming object win. The typename can change when a different subtype
    // of a union or interface is written to the cache.
    if (
      typeof eType === 'string' &&
      typeof iType === 'string' &&
      eType !== iType
    ) {
      return incoming;
    }

    const childMergeOverrides = mergeChildObj && mergeChildObj.child;

    if (isReference(incoming)) {
      if (isReference(existing)) {
        // Incoming references always replace existing references, but we can
        // avoid changing the object identity when the __ref is the same.
        return incoming.__ref === existing.__ref ? existing : incoming;
      }
      // Incoming references can be merged with existing non-reference data
      // if the existing data appears to be of a compatible type.
      store.set(
        incoming.__ref,
        this.merge(
          existing,
          store.get(incoming.__ref),
          store,
          childMergeOverrides,
        ),
      );
      return incoming;
    } else if (isReference(existing)) {
      throw new InvariantError(
        `Store error: the application attempted to write an object with no provided id but the store already contains an id of ${existing.__ref} for this object.`,
      );
    }

    if (Array.isArray(incoming)) {
      if (!Array.isArray(existing)) return incoming;
      if (existing.length > incoming.length) {
        // Allow the incoming array to truncate the existing array, if the
        // incoming array is shorter.
        return this.merge(
          existing.slice(0, incoming.length),
          incoming,
          store,
          childMergeOverrides,
        );
      }
    }

    return this.merge(existing, incoming, store, childMergeOverrides);
  }

  return incoming;
}
