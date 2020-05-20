import type { SelectionSetNode, FieldNode, DocumentNode } from 'graphql';
import { InvariantError } from 'ts-invariant';

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
  StoreObject,
  Reference,
} from '../../utilities/graphql/storeUtils';

import { shouldInclude, hasDirectives } from '../../utilities/graphql/directives';
import { cloneDeep } from '../../utilities/common/cloneDeep';

import type { Policies, ReadMergeContext } from './policies';
import { EntityStore } from './entityStore';
import type { NormalizedCache } from './types';
import { makeProcessedFieldsMerger, FieldValueToBeMerged } from './helpers';
import type { StoreReader } from './readFromStore';

export interface WriteContext extends ReadMergeContext {
  readonly store: NormalizedCache;
  readonly written: {
    [dataId: string]: SelectionSetNode[];
  };
  readonly fragmentMap?: FragmentMap;
  // General-purpose deep-merge function for use during writes.
  merge<T>(existing: T, incoming: T): T;
}

interface ProcessSelectionSetOptions {
  dataId?: string,
  result: Record<string, any>;
  selectionSet: SelectionSetNode;
  context: WriteContext;
  typename?: string;
  out?: {
    shouldApplyMerges: boolean;
  };
}

export interface StoreWriterConfig {
  reader?: StoreReader;
  policies: Policies;
};

export class StoreWriter {
  constructor(private config: StoreWriterConfig) {}

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
    store = new EntityStore.Root({
      policies: this.config.policies,
    }),
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

    variables = {
      ...getDefaultValues(operationDefinition),
      ...variables,
    };

    this.processSelectionSet({
      result: result || Object.create(null),
      // Since we already know the dataId here, pass it to
      // processSelectionSet to skip calling policies.identify
      // unnecessarily.
      dataId,
      selectionSet: operationDefinition.selectionSet,
      // If dataId is a well-known root ID such as ROOT_QUERY, we can
      // infer its __typename immediately here. Otherwise, the __typename
      // will be determined in processSelectionSet, as usual.
      typename: this.config.policies.rootTypenamesById[dataId],
      context: {
        store,
        written: Object.create(null),
        merge<T>(existing: T, incoming: T) {
          return merger.merge(existing, incoming) as T;
        },
        variables,
        varString: JSON.stringify(variables),
        fragmentMap: createFragmentMap(getFragmentDefinitions(query)),
        toReference: store.toReference,
        getFieldValue: store.getFieldValue,
      },
    });

    return store;
  }

  private processSelectionSet({
    dataId,
    result,
    selectionSet,
    context,
    typename,
    // This object allows processSelectionSet to report useful information
    // to its callers without explicitly returning that information.
    out = {
      shouldApplyMerges: false,
    },
  }: ProcessSelectionSetOptions): StoreObject | Reference {
    const { policies, reader } = this.config;

    // This mergedFields variable will be repeatedly updated using context.merge
    // to accumulate all fields that need to be written into the store.
    let mergedFields: StoreObject = Object.create(null);

    // Identify the result object, even if dataId was already provided,
    // since we always need keyObject below.
    const [id, keyObject] =
      policies.identify(result, selectionSet, context.fragmentMap);

    // If dataId was not provided, fall back to the id just generated by
    // policies.identify.
    dataId = dataId || id;

    // Write any key fields that were used during identification, even if
    // they were not mentioned in the original query.
    if (keyObject) {
      mergedFields = context.merge(mergedFields, keyObject);
    }

    if ("string" === typeof dataId) {
      // Avoid processing the same entity object using the same selection
      // set more than once. We use an array instead of a Set since most
      // entity IDs will be written using only one selection set, so the
      // size of this array is likely to be very small, meaning indexOf is
      // likely to be faster than Set.prototype.has.
      const sets = context.written[dataId] || (context.written[dataId] = []);
      const ref = makeReference(dataId);
      if (sets.indexOf(selectionSet) >= 0) return ref;
      sets.push(selectionSet);

      // If we're about to write a result object into the store, but we
      // happen to know that the exact same (===) result object would be
      // returned if we were to reread the result with the same inputs,
      // then we can skip the rest of the processSelectionSet work for
      // this object, and immediately return a Reference to it.
      if (reader && reader.isFresh(
        result,
        context.store,
        ref,
        selectionSet,
        context.varString,
      )) {
        return ref;
      }
    }

    // If typename was not passed in, infer it. Note that typename is
    // always passed in for tricky-to-infer cases such as "Query" for
    // ROOT_QUERY.
    typename = typename ||
      getTypenameFromResult(result, selectionSet, context.fragmentMap) ||
      (dataId && context.store.get(dataId, "__typename") as string);

    if ("string" === typeof typename) {
      mergedFields.__typename = typename;
    }

    const workSet = new Set(selectionSet.selections);

    workSet.forEach(selection => {
      if (!shouldInclude(selection, context.variables)) return;

      if (isField(selection)) {
        const resultFieldKey = resultKeyNameFromField(selection);
        const value = result[resultFieldKey];

        if (typeof value !== 'undefined') {
          const storeFieldName = policies.getStoreFieldName({
            typename,
            fieldName: selection.name.value,
            field: selection,
            variables: context.variables,
          });

          let incomingValue =
            this.processFieldValue(value, selection, context, out);

          if (policies.hasMergeFunction(typename, selection.name.value)) {
            // If a custom merge function is defined for this field, store
            // a special FieldValueToBeMerged object, so that we can run
            // the merge function later, after all processSelectionSet
            // work is finished.
            incomingValue = {
              __field: selection,
              __typename: typename,
              __value: incomingValue,
            } as FieldValueToBeMerged;

            // Communicate to the caller that mergedFields contains at
            // least one FieldValueToBeMerged.
            out.shouldApplyMerges = true;
          }

          mergedFields = context.merge(mergedFields, {
            [storeFieldName]: incomingValue,
          });

        } else if (
          policies.usingPossibleTypes &&
          !hasDirectives(["defer", "client"], selection)
        ) {
          throw new InvariantError(
            `Missing field '${resultFieldKey}' in ${JSON.stringify(
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

        if (fragment && policies.fragmentMatches(fragment, typename)) {
          fragment.selectionSet.selections.forEach(workSet.add, workSet);
        }
      }
    });

    if ("string" === typeof dataId) {
      const entityRef = makeReference(dataId);

      if (out.shouldApplyMerges) {
        mergedFields = policies.applyMerges(entityRef, mergedFields, context);
      }

      context.store.merge(dataId, mergedFields);

      return entityRef;
    }

    return mergedFields;
  }

  private processFieldValue(
    value: any,
    field: FieldNode,
    context: WriteContext,
    out: ProcessSelectionSetOptions["out"],
  ): StoreValue {
    if (!field.selectionSet || value === null) {
      // In development, we need to clone scalar values so that they can be
      // safely frozen with maybeDeepFreeze in readFromStore.ts. In production,
      // it's cheaper to store the scalar values directly in the cache.
      return process.env.NODE_ENV === 'production' ? value : cloneDeep(value);
    }

    if (Array.isArray(value)) {
      return value.map(item => this.processFieldValue(item, field, context, out));
    }

    return this.processSelectionSet({
      result: value,
      selectionSet: field.selectionSet,
      context,
      out,
    });
  }
}
