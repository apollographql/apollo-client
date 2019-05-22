import {
  SelectionSetNode,
  FieldNode,
  DocumentNode,
  InlineFragmentNode,
  FragmentDefinitionNode,
} from 'graphql';
import { FragmentMatcher } from './readFromStore';

import {
  assign,
  createFragmentMap,
  FragmentMap,
  getDefaultValues,
  getFragmentDefinitions,
  getOperationDefinition,
  IdValue,
  isField,
  isIdValue,
  isInlineFragment,
  isProduction,
  resultKeyNameFromField,
  shouldInclude,
  storeKeyNameFromField,
  StoreValue,
  toIdValue,
  isEqual,
} from 'apollo-utilities';

import { invariant } from 'ts-invariant';

import { ObjectCache } from './objectCache';
import { defaultNormalizedCacheFactory } from './depTrackingCache';

import {
  IdGetter,
  NormalizedCache,
  ReadStoreContext,
  StoreObject,
} from './types';

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
  readonly processedData?: { [x: string]: FieldNode[] };
  readonly variables?: any;
  readonly dataIdFromObject?: IdGetter;
  readonly fragmentMap?: FragmentMap;
  readonly fragmentMatcherFunction?: FragmentMatcher;
};

export class StoreWriter {
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
    store = defaultNormalizedCacheFactory(),
    variables,
    dataIdFromObject,
    fragmentMatcherFunction,
  }: {
    query: DocumentNode;
    result: Object;
    store?: NormalizedCache;
    variables?: Object;
    dataIdFromObject?: IdGetter;
    fragmentMatcherFunction?: FragmentMatcher;
  }): NormalizedCache {
    return this.writeResultToStore({
      dataId: 'ROOT_QUERY',
      result,
      document: query,
      store,
      variables,
      dataIdFromObject,
      fragmentMatcherFunction,
    });
  }

  public writeResultToStore({
    dataId,
    result,
    document,
    store = defaultNormalizedCacheFactory(),
    variables,
    dataIdFromObject,
    fragmentMatcherFunction,
  }: {
    dataId: string;
    result: any;
    document: DocumentNode;
    store?: NormalizedCache;
    variables?: Object;
    dataIdFromObject?: IdGetter;
    fragmentMatcherFunction?: FragmentMatcher;
  }): NormalizedCache {
    // XXX TODO REFACTOR: this is a temporary workaround until query normalization is made to work with documents.
    const operationDefinition = getOperationDefinition(document);

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
          fragmentMap: createFragmentMap(getFragmentDefinitions(document)),
          fragmentMatcherFunction,
        },
      });
    } catch (e) {
      throw enhanceErrorWithDocument(e, document);
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
    const { variables, store, fragmentMap } = context;

    selectionSet.selections.forEach(selection => {
      if (!shouldInclude(selection, variables)) {
        return;
      }

      if (isField(selection)) {
        const resultFieldKey: string = resultKeyNameFromField(selection);
        const value: any = result[resultFieldKey];

        if (typeof value !== 'undefined') {
          this.writeFieldToStore({
            dataId,
            value,
            field: selection,
            context,
          });
        } else {
          let isDefered = false;
          let isClient = false;
          if (selection.directives && selection.directives.length) {
            // If this is a defered field we don't need to throw / warn.
            isDefered = selection.directives.some(
              directive => directive.name && directive.name.value === 'defer',
            );

            // When using the @client directive, it might be desirable in
            // some cases to want to write a selection set to the store,
            // without having all of the selection set values available.
            // This is because the @client field values might have already
            // been written to the cache separately (e.g. via Apollo
            // Cache's `writeData` capabilities). Because of this, we'll
            // skip the missing field warning for fields with @client
            // directives.
            isClient = selection.directives.some(
              directive => directive.name && directive.name.value === 'client',
            );
          }

          if (!isDefered && !isClient && context.fragmentMatcherFunction) {
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
        }
      } else {
        // This is not a field, so it must be a fragment, either inline or named
        let fragment: InlineFragmentNode | FragmentDefinitionNode;

        if (isInlineFragment(selection)) {
          fragment = selection;
        } else {
          // Named fragment
          fragment = (fragmentMap || {})[selection.name.value];
          invariant(fragment, `No fragment named ${selection.name.value}.`);
        }

        let matches = true;
        if (context.fragmentMatcherFunction && fragment.typeCondition) {
          // TODO we need to rewrite the fragment matchers for this to work properly and efficiently
          // Right now we have to pretend that we're passing in an idValue and that there's a store
          // on the context.
          const id = dataId || 'self';
          const idValue = toIdValue({ id, typename: undefined });
          const fakeContext: ReadStoreContext = {
            // NOTE: fakeContext always uses ObjectCache
            // since this is only to ensure the return value of 'matches'
            store: new ObjectCache({ [id]: result }),
            cacheRedirects: {},
          };
          const match = context.fragmentMatcherFunction(
            idValue,
            fragment.typeCondition.name.value,
            fakeContext,
          );
          if (!isProduction() && match === 'heuristic') {
            invariant.error('WARNING: heuristic fragment matching going on!');
          }
          matches = !!match;
        }

        if (matches) {
          this.writeSelectionSetToStore({
            result,
            selectionSet: fragment.selectionSet,
            dataId,
            context,
          });
        }
      }
    });

    return store;
  }

  private writeFieldToStore({
    field,
    value,
    dataId,
    context,
  }: {
    field: FieldNode;
    value: any;
    dataId: string;
    context: WriteContext;
  }) {
    const { variables, dataIdFromObject, store } = context;

    let storeValue: StoreValue;
    let storeObject: StoreObject;

    const storeFieldName: string = storeKeyNameFromField(field, variables);

    // If this is a scalar value...
    if (!field.selectionSet || value === null) {
      storeValue =
        value != null && typeof value === 'object'
          ? // If the scalar value is a JSON blob, we have to "escape" it so it can’t pretend to be
            // an id.
            { type: 'json', json: value }
          : // Otherwise, just store the scalar directly in the store.
            value;
    } else if (Array.isArray(value)) {
      const generatedId = `${dataId}.${storeFieldName}`;

      storeValue = this.processArrayValue(
        value,
        generatedId,
        field.selectionSet,
        context,
      );
    } else {
      // It's an object
      let valueDataId = `${dataId}.${storeFieldName}`;
      let generated = true;

      // We only prepend the '$' if the valueDataId isn't already a generated
      // id.
      if (!isGeneratedId(valueDataId)) {
        valueDataId = '$' + valueDataId;
      }

      if (dataIdFromObject) {
        const semanticId = dataIdFromObject(value);

        // We throw an error if the first character of the id is '$. This is
        // because we use that character to designate an Apollo-generated id
        // and we use the distinction between user-desiginated and application-provided
        // ids when managing overwrites.
        invariant(
          !semanticId || !isGeneratedId(semanticId),
          'IDs returned by dataIdFromObject cannot begin with the "$" character.',
        );

        if (
          semanticId ||
          (typeof semanticId === 'number' && semanticId === 0)
        ) {
          valueDataId = semanticId;
          generated = false;
        }
      }

      if (!isDataProcessed(valueDataId, field, context.processedData)) {
        this.writeSelectionSetToStore({
          dataId: valueDataId,
          result: value,
          selectionSet: field.selectionSet,
          context,
        });
      }

      // We take the id and escape it (i.e. wrap it with an enclosing object).
      // This allows us to distinguish IDs from normal scalars.
      const typename = value.__typename;
      storeValue = toIdValue({ id: valueDataId, typename }, generated);

      // check if there was a generated id at the location where we're
      // about to place this new id. If there was, we have to merge the
      // data from that id with the data we're about to write in the store.
      storeObject = store.get(dataId);
      const escapedId =
        storeObject && (storeObject[storeFieldName] as IdValue | undefined);
      if (escapedId !== storeValue && isIdValue(escapedId)) {
        const hadTypename = escapedId.typename !== undefined;
        const hasTypename = typename !== undefined;
        const typenameChanged =
          hadTypename && hasTypename && escapedId.typename !== typename;

        // If there is already a real id in the store and the current id we
        // are dealing with is generated, we throw an error.
        // One exception we allow is when the typename has changed, which occurs
        // when schema defines a union, both with and without an ID in the same place.
        // checks if we "lost" the read id
        invariant(
          !generated || escapedId.generated || typenameChanged,
          `Store error: the application attempted to write an object with no provided id but the store already contains an id of ${
            escapedId.id
          } for this object. The selectionSet that was trying to be written is:\n${
            JSON.stringify(field)
          }`,
        );

        // checks if we "lost" the typename
        invariant(
          !hadTypename || hasTypename,
          `Store error: the application attempted to write an object with no provided typename but the store already contains an object with typename of ${
            escapedId.typename
          } for the object of id ${escapedId.id}. The selectionSet that was trying to be written is:\n${
            JSON.stringify(field)
          }`,
        );

        if (escapedId.generated) {
          // We should only merge if it's an object of the same type,
          // otherwise we should delete the generated object
          if (typenameChanged) {
            // Only delete the generated object when the old object was
            // inlined, and the new object is not. This is indicated by
            // the old id being generated, and the new id being real.
            if (!generated) {
              store.delete(escapedId.id);
            }
          } else {
            mergeWithGenerated(escapedId.id, (storeValue as IdValue).id, store);
          }
        }
      }
    }

    storeObject = store.get(dataId);
    if (!storeObject || !isEqual(storeValue, storeObject[storeFieldName])) {
      store.set(dataId, {
        ...storeObject,
        [storeFieldName]: storeValue,
      });
    }
  }

  private processArrayValue(
    value: any[],
    generatedId: string,
    selectionSet: SelectionSetNode,
    context: WriteContext,
  ): any[] {
    return value.map((item: any, index: any) => {
      if (item === null) {
        return null;
      }

      let itemDataId = `${generatedId}.${index}`;

      if (Array.isArray(item)) {
        return this.processArrayValue(item, itemDataId, selectionSet, context);
      }

      let generated = true;

      if (context.dataIdFromObject) {
        const semanticId = context.dataIdFromObject(item);

        if (semanticId) {
          itemDataId = semanticId;
          generated = false;
        }
      }

      if (!isDataProcessed(itemDataId, selectionSet, context.processedData)) {
        this.writeSelectionSetToStore({
          dataId: itemDataId,
          result: item,
          selectionSet,
          context,
        });
      }

      return toIdValue(
        { id: itemDataId, typename: item.__typename },
        generated,
      );
    });
  }
}

// Checks if the id given is an id that was generated by Apollo
// rather than by dataIdFromObject.
function isGeneratedId(id: string): boolean {
  return id[0] === '$';
}

function mergeWithGenerated(
  generatedKey: string,
  realKey: string,
  cache: NormalizedCache,
): boolean {
  if (generatedKey === realKey) {
    return false;
  }

  const generated = cache.get(generatedKey);
  const real = cache.get(realKey);
  let madeChanges = false;

  Object.keys(generated).forEach(key => {
    const value = generated[key];
    const realValue = real[key];

    if (
      isIdValue(value) &&
      isGeneratedId(value.id) &&
      isIdValue(realValue) &&
      !isEqual(value, realValue) &&
      mergeWithGenerated(value.id, realValue.id, cache)
    ) {
      madeChanges = true;
    }
  });

  cache.delete(generatedKey);
  const newRealValue = { ...generated, ...real };

  if (isEqual(newRealValue, real)) {
    return madeChanges;
  }

  cache.set(realKey, newRealValue);
  return true;
}

function isDataProcessed(
  dataId: string,
  field: FieldNode | SelectionSetNode,
  processedData?: { [x: string]: (FieldNode | SelectionSetNode)[] },
): boolean {
  if (!processedData) {
    return false;
  }

  if (processedData[dataId]) {
    if (processedData[dataId].indexOf(field) >= 0) {
      return true;
    } else {
      processedData[dataId].push(field);
    }
  } else {
    processedData[dataId] = [field];
  }

  return false;
}
