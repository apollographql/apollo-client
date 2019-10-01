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
  isField,
  resultKeyNameFromField,
  StoreValue,
  getTypenameFromResult,
  makeReference,
  isReference,
} from '../../utilities/graphql/storeUtils';
import { shouldInclude } from '../../utilities/graphql/directives';
import { DeepMerger } from '../../utilities/common/mergeDeep';
import { cloneDeep } from '../../utilities/common/cloneDeep';
import { defaultNormalizedCacheFactory } from './entityCache';
import { NormalizedCache, StoreObject } from './types';
import { getTypenameFromStoreObject } from './helpers';
import { Policies } from './policies';

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
) => StoreObject;

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
    const storeObjectMerger = makeStoreObjectMerger(store);

    return this.writeSelectionSetToStore({
      result,
      dataId,
      selectionSet: operationDefinition.selectionSet,
      context: {
        store,
        written: Object.create(null),
        mergeFields(existing: StoreObject, incoming: StoreObject) {
          return simpleFieldsMerger.merge(existing, incoming);
        },
        mergeStoreObjects(existing: StoreObject, incoming: StoreObject) {
          return storeObjectMerger.merge(existing, incoming);
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
    result,
    dataId,
    selectionSet,
    context,
  }: {
    dataId: string;
    result: any;
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

    const newFields = this.processSelectionSet({
      result,
      selectionSet,
      context,
    });

    store.set(
      dataId,
      context.mergeStoreObjects(
        store.get(dataId) || Object.create(null),
        newFields,
      ),
    );

    return store;
  }

  private processSelectionSet({
    result,
    selectionSet,
    context,
    typename = getTypenameFromResult(
      result, selectionSet, context.fragmentMap),
  }: {
    result: any;
    selectionSet: SelectionSetNode;
    typename?: string;
    context: WriteContext;
  }): StoreObject {
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
          mergedFields = context.mergeFields(mergedFields, {
            [storeFieldName]: this.processFieldValue(
              value,
              selection,
              context,
            ),
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

        const match = this.policies.fragmentMatches(fragment, typename);
        if (match && (result || typename === 'Query')) {
          mergedFields = context.mergeFields(
            mergedFields,
            this.processSelectionSet({
              result,
              selectionSet: fragment.selectionSet,
              typename,
              context,
            }),
          );
        }
      }
    });

    return mergedFields;
  }

  private processFieldValue(
    value: any,
    field: FieldNode,
    context: WriteContext,
  ): StoreValue {
    if (!field.selectionSet || value === null) {
      // In development, we need to clone scalar values so that they can be
      // safely frozen with maybeDeepFreeze in readFromStore.ts. In production,
      // it's cheaper to store the scalar values directly in the cache.
      return process.env.NODE_ENV === 'production' ? value : cloneDeep(value);
    }

    if (Array.isArray(value)) {
      return value.map(item => this.processFieldValue(item, field, context));
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
        return makeReference(dataId);
      }
    }

    return this.processSelectionSet({
      result: value,
      selectionSet: field.selectionSet,
      context,
    });
  }
}

function makeStoreObjectMerger(store: NormalizedCache) {
  return new DeepMerger(function(existingObject, incomingObject, property) {
    // In the future, reconciliation logic may depend on the type of the parent
    // StoreObject, not just the values of the given property.
    const existing = existingObject[property];
    const incoming = incomingObject[property];

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
          this.merge(existing, store.get(incoming.__ref)),
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
          return this.merge(existing.slice(0, incoming.length), incoming);
        }
      }

      return this.merge(existing, incoming);
    }

    return incoming;
  });
}
