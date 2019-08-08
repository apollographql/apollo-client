import {
  SelectionSetNode,
  FieldNode,
  DocumentNode,
  InlineFragmentNode,
  FragmentDefinitionNode,
} from 'graphql';

import {
  assign,
  createFragmentMap,
  FragmentMap,
  getDefaultValues,
  getFragmentDefinitions,
  getOperationDefinition,
  isField,
  isInlineFragment,
  resultKeyNameFromField,
  shouldInclude,
  storeKeyNameFromField,
  StoreValue,
  DeepMerger,
} from 'apollo-utilities';

import { invariant } from 'ts-invariant';

import { defaultNormalizedCacheFactory } from './depTrackingCache';

import { IdGetter, NormalizedCache, StoreObject } from './types';
import { fragmentMatches } from './fragments';
import { makeReference, isReference } from './references';
import { defaultDataIdFromObject } from './inMemoryCache';

export class WriteError extends Error {
  public type = 'WriteError';
}

export function enhanceErrorWithDocument(error: Error, document: DocumentNode) {
  // XXX A bit hacky maybe ...
  const enhancedError = new WriteError(
    `Error writing result to store for query:\n ${JSON.stringify(document)}`,
  );
  enhancedError.message += '\n' + error.message;
  enhancedError.stack = error.stack;
  return enhancedError;
}

export type WriteContext = {
  readonly store: NormalizedCache;
  readonly processedData: { [x: string]: Set<FieldNode> };
  readonly variables?: any;
  readonly dataIdFromObject?: IdGetter;
  readonly fragmentMap?: FragmentMap;
};

type PossibleTypes = import('./inMemoryCache').InMemoryCache['possibleTypes'];
export interface StoreWriterConfig {
  possibleTypes?: PossibleTypes;
}

export class StoreWriter {
  constructor(private config: StoreWriterConfig = {}) {}

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
   *
   * @param dataIdFromObject A function that returns an object identifier given a particular result
   * object. See the store documentation for details and an example of this function.
   *
   * @param fragmentMatcherFunction A function to use for matching fragment conditions in GraphQL documents
   */
  public writeQueryToStore({
    query,
    result,
    dataId = 'ROOT_QUERY',
    store = defaultNormalizedCacheFactory(),
    variables,
    dataIdFromObject = defaultDataIdFromObject,
  }: {
    query: DocumentNode;
    result: Object;
    dataId?: string;
    store?: NormalizedCache;
    variables?: Object;
    dataIdFromObject?: IdGetter;
  }): NormalizedCache {
    const operationDefinition = getOperationDefinition(query)!;
    try {
      return this.writeSelectionSetToStore({
        result,
        dataId,
        selectionSet: operationDefinition.selectionSet,
        context: {
          store,
          processedData: {},
          variables: assign(
            {},
            getDefaultValues(operationDefinition),
            variables,
          ),
          dataIdFromObject,
          fragmentMap: createFragmentMap(getFragmentDefinitions(query)),
        },
      });
    } catch (e) {
      throw enhanceErrorWithDocument(e, query);
    }
  }

  public writeSelectionSetToStore({
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
    const { store } = context;
    const storeObject = store.get(dataId);
    const typename = dataId === 'ROOT_QUERY' ? 'Query' :
      (result && result.__typename) ||
      (storeObject && storeObject.__typename);

    const newFields = this.processSelectionSet({
      result,
      typename,
      selectionSet,
      context,
    });

    store.set(dataId, mergeStoreObjects(store, store.get(dataId), newFields));

    return store;
  }

  private processSelectionSet({
    result,
    selectionSet,
    typename = result && result.__typename,
    context,
  }: {
    result: any;
    selectionSet: SelectionSetNode;
    typename?: string;
    context: WriteContext;
  }): StoreObject {
    const newFields: {
      [storeFieldName: string]: StoreValue;
    } = Object.create(null);

    selectionSet.selections.forEach(selection => {
      if (!shouldInclude(selection, context.variables)) {
        return;
      }

      if (isField(selection)) {
        const resultFieldKey = resultKeyNameFromField(selection);
        const value = result[resultFieldKey];

        if (typeof value !== 'undefined') {
          const storeFieldName = storeKeyNameFromField(
            selection,
            context.variables,
          );
          newFields[storeFieldName] = this.processFieldValue(
            value,
            selection,
            context,
          );
        } else if (
          this.config.possibleTypes &&
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
        let fragment: InlineFragmentNode | FragmentDefinitionNode;

        if (isInlineFragment(selection)) {
          fragment = selection;
        } else {
          // Named fragment
          fragment = (context.fragmentMap || {})[selection.name.value];
          invariant(fragment, `No fragment named ${selection.name.value}.`);
        }

        const match = fragmentMatches(
          fragment,
          typename,
          this.config.possibleTypes,
        );

        if (match && (result || typename === 'Query')) {
          Object.assign(
            newFields,
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

    return newFields;
  }

  private processFieldValue(
    value: any,
    field: FieldNode,
    context: WriteContext,
  ): StoreValue {
    if (!field.selectionSet || value === null) {
      return value;
    }

    if (Array.isArray(value)) {
      return value.map((item, index) => {
        return this.processFieldValue(item, field, context);
      });
    }

    if (value && context.dataIdFromObject) {
      const dataId = context.dataIdFromObject(value);
      if (typeof dataId === 'string') {
        if (!isDataProcessed(dataId, field, context.processedData)) {
          this.writeSelectionSetToStore({
            dataId,
            result: value,
            selectionSet: field.selectionSet,
            context,
          });
        }
        return makeReference(dataId, value.__typename);
      }
    }

    return this.processSelectionSet({
      result: value,
      selectionSet: field.selectionSet,
      context,
    });
  }
}

function mergeStoreObjects(
  store: NormalizedCache,
  existing: StoreObject,
  incoming: StoreObject,
): StoreObject {
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
      const eType = getTypenameFromStoreObject(existing);
      const iType = getTypenameFromStoreObject(incoming);
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
        // Incoming references always overwrite existing references.
        if (isReference(existing)) return incoming;
        // Incoming references can be merged with existing non-reference data
        // if the existing data appears to be of a compatible type.
        store.set(incoming.id, this.merge(existing, store.get(incoming.id)));
        return incoming;
      }

      invariant(
        !isReference(existing),
        `Store error: the application attempted to write an object with no provided id but the store already contains an id of ${existing.id} for this object.`,
      );

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
  }).merge(existing, incoming);
}

function getTypenameFromStoreObject(
  storeObject: StoreObject,
): string | undefined {
  return isReference(storeObject)
    && storeObject.typename
    || storeObject.__typename;
}

function isDataProcessed(
  dataId: string,
  field: FieldNode,
  processedData: { [x: string]: Set<typeof field> },
): boolean {
  const fieldSet = processedData[dataId];
  if (fieldSet) {
    if (fieldSet.has(field)) return true;
    fieldSet.add(field);
  } else {
    processedData[dataId] = new Set([field]);
  }
  return false;
}
