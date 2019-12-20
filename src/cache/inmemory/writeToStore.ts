import { SelectionSetNode, FieldNode, DocumentNode } from 'graphql';
import { invariant } from 'ts-invariant';

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
  isField,
  resultKeyNameFromField,
  StoreValue,
} from '../../utilities/graphql/storeUtils';

import { shouldInclude } from '../../utilities/graphql/directives';
import { cloneDeep } from '../../utilities/common/cloneDeep';

import { Policies, FieldValueGetter } from './policies';
import { defaultNormalizedCacheFactory } from './entityStore';
import { NormalizedCache, StoreObject } from './types';
import { makeProcessedFieldsMerger } from './helpers';

export type WriteContext = {
  readonly store: NormalizedCache;
  readonly written: {
    [dataId: string]: SelectionSetNode[];
  };
  readonly variables?: any;
  readonly fragmentMap?: FragmentMap;
  getFieldValue: FieldValueGetter;
  // General-purpose deep-merge function for use during writes.
  merge<T>(existing: T, incoming: T): T;
};

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

    const merger = makeProcessedFieldsMerger();

    return this.writeSelectionSetToStore({
      result: result || Object.create(null),
      dataId,
      selectionSet: operationDefinition.selectionSet,
      context: {
        store,
        written: Object.create(null),
        merge<T>(existing: T, incoming: T) {
          return merger.merge(existing, incoming) as T;
        },
        variables: {
          ...getDefaultValues(operationDefinition),
          ...variables,
        },
        fragmentMap: createFragmentMap(getFragmentDefinitions(query)),
        getFieldValue: this.policies.makeFieldValueGetter(store),
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
    const { policies } = this;
    const { store, written } = context;

    // Avoid processing the same entity object using the same selection set
    // more than once. We use an array instead of a Set since most entity IDs
    // will be written using only one selection set, so the size of this array
    // is likely to be very small, meaning indexOf is likely to be faster than
    // Set.prototype.has.
    const sets = written[dataId] || (written[dataId] = []);
    if (sets.indexOf(selectionSet) >= 0) return store;
    sets.push(selectionSet);

    const entityRef = makeReference(dataId);
    const typename =
      // If the result has a __typename, trust that.
      getTypenameFromResult(result, selectionSet, context.fragmentMap) ||
      // If the entity identified by dataId has a __typename in the store,
      // fall back to that.
      context.getFieldValue<string>(entityRef, "__typename");

    store.merge(
      dataId,
      policies.applyMerges(
        entityRef,
        this.processSelectionSet({
          result,
          selectionSet,
          context,
          typename,
        }),
        context.getFieldValue,
        context.variables,
      ),
    );

    return store;
  }

  private processSelectionSet({
    result,
    selectionSet,
    context,
    typename,
  }: {
    result: Record<string, any>;
    selectionSet: SelectionSetNode;
    context: WriteContext;
    typename: string;
  }): StoreObject {
    let mergedFields: StoreObject = Object.create(null);
    if (typeof typename === "string") {
      mergedFields.__typename = typename;
    }

    selectionSet.selections.forEach(selection => {
      if (!shouldInclude(selection, context.variables)) {
        return;
      }

      const { policies } = this;

      if (isField(selection)) {
        const resultFieldKey = resultKeyNameFromField(selection);
        const value = result[resultFieldKey];

        if (typeof value !== 'undefined') {
          const storeFieldName = policies.getStoreFieldName(
            typename,
            selection,
            context.variables,
          );

          const incomingValue =
            this.processFieldValue(value, selection, context);

          mergedFields = context.merge(mergedFields, {
            // If a custom merge function is defined for this field, store
            // a special FieldValueToBeMerged object, so that we can run
            // the merge function later, after all processSelectionSet
            // work is finished.
            [storeFieldName]: policies.hasMergeFunction(
              typename,
              selection.name.value,
            ) ? {
              __field: selection,
              __typename: typename,
              __value: incomingValue,
            } : incomingValue,
          });

        } else if (
          policies.usingPossibleTypes &&
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

        if (policies.fragmentMatches(fragment, typename)) {
          mergedFields = context.merge(
            mergedFields,
            this.processSelectionSet({
              result,
              selectionSet: fragment.selectionSet,
              context,
              typename,
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
      return value.map((item, i) => this.processFieldValue(item, field, context));
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
      typename: getTypenameFromResult(
        value, field.selectionSet, context.fragmentMap),
    });
  }
}
