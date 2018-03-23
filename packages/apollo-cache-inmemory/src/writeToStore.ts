import {
  SelectionSetNode,
  FieldNode,
  DocumentNode,
  InlineFragmentNode,
  OperationDefinitionNode,
  FragmentDefinitionNode,
} from 'graphql';
import { print } from 'graphql/language/printer';
import { FragmentMatcher } from 'graphql-anywhere';

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
  getQueryDefinition,
  StoreValue,
  toIdValue,
} from 'apollo-utilities';

import { defaultNormalizedCacheFactory, ObjectCache } from './objectCache';

import {
  IdGetter,
  NormalizedCache,
  NormalizedCacheFactory,
  ReadStoreContext,
  StoreObject,
} from './types';

export class WriteError extends Error {
  public type = 'WriteError';
}

export function enhanceErrorWithDocument(error: Error, document: DocumentNode) {
  // XXX A bit hacky maybe ...
  const enhancedError = new WriteError(
    `Error writing result to store for query:\n ${print(document)}`,
  );
  enhancedError.message += '\n' + error.message;
  enhancedError.stack = error.stack;
  return enhancedError;
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
 *
 * @param dataIdFromObject A function that returns an object identifier given a particular result
 * object. See the store documentation for details and an example of this function.
 *
 * @param fragmentMap A map from the name of a fragment to its fragment definition. These fragments
 * can be referenced within the query document.
 *
 * @param fragmentMatcherFunction A function to use for matching fragment conditions in GraphQL documents
 */
export function writeQueryToStore({
  result,
  query,
  storeFactory = defaultNormalizedCacheFactory,
  store = storeFactory(),
  variables,
  dataIdFromObject,
  fragmentMap = {} as FragmentMap,
  fragmentMatcherFunction,
}: {
  result: Object;
  query: DocumentNode;
  store?: NormalizedCache;
  storeFactory?: NormalizedCacheFactory;
  variables?: Object;
  dataIdFromObject?: IdGetter;
  fragmentMap?: FragmentMap;
  fragmentMatcherFunction?: FragmentMatcher;
}): NormalizedCache {
  const queryDefinition: OperationDefinitionNode = getQueryDefinition(query);

  variables = assign({}, getDefaultValues(queryDefinition), variables);

  try {
    return writeSelectionSetToStore({
      dataId: 'ROOT_QUERY',
      result,
      selectionSet: queryDefinition.selectionSet,
      context: {
        store,
        storeFactory,
        processedData: {},
        variables,
        dataIdFromObject,
        fragmentMap,
        fragmentMatcherFunction,
      },
    });
  } catch (e) {
    throw enhanceErrorWithDocument(e, query);
  }
}

export type WriteContext = {
  store: NormalizedCache;
  storeFactory: NormalizedCacheFactory;
  processedData?: { [x: string]: FieldNode[] };
  variables?: any;
  dataIdFromObject?: IdGetter;
  fragmentMap?: FragmentMap;
  fragmentMatcherFunction?: FragmentMatcher;
};

export function writeResultToStore({
  dataId,
  result,
  document,
  storeFactory = defaultNormalizedCacheFactory,
  store = storeFactory(),
  variables,
  dataIdFromObject,
  fragmentMatcherFunction,
}: {
  dataId: string;
  result: any;
  document: DocumentNode;
  store?: NormalizedCache;
  storeFactory?: NormalizedCacheFactory;
  variables?: Object;
  dataIdFromObject?: IdGetter;
  fragmentMatcherFunction?: FragmentMatcher;
}): NormalizedCache {
  // XXX TODO REFACTOR: this is a temporary workaround until query normalization is made to work with documents.
  const operationDefinition = getOperationDefinition(document);
  const selectionSet = operationDefinition.selectionSet;
  const fragmentMap = createFragmentMap(getFragmentDefinitions(document));

  variables = assign({}, getDefaultValues(operationDefinition), variables);

  try {
    return writeSelectionSetToStore({
      result,
      dataId,
      selectionSet,
      context: {
        store,
        storeFactory,
        processedData: {},
        variables,
        dataIdFromObject,
        fragmentMap,
        fragmentMatcherFunction,
      },
    });
  } catch (e) {
    throw enhanceErrorWithDocument(e, document);
  }
}

export function writeSelectionSetToStore({
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
    const included = shouldInclude(selection, variables);

    if (isField(selection)) {
      const resultFieldKey: string = resultKeyNameFromField(selection);
      const value: any = result[resultFieldKey];

      if (included) {
        if (typeof value !== 'undefined') {
          writeFieldToStore({
            dataId,
            value,
            field: selection,
            context,
          });
        } else {
          // if this is a defered field we don't need to throw / wanr
          const isDefered =
            selection.directives &&
            selection.directives.length &&
            selection.directives.some(
              directive => directive.name && directive.name.value === 'defer',
            );

          if (!isDefered && context.fragmentMatcherFunction) {
            // XXX We'd like to throw an error, but for backwards compatibility's sake
            // we just print a warning for the time being.
            //throw new WriteError(`Missing field ${resultFieldKey} in ${JSON.stringify(result, null, 2).substring(0, 100)}`);
            if (!isProduction()) {
              console.warn(
                `Missing field ${resultFieldKey} in ${JSON.stringify(
                  result,
                  null,
                  2,
                ).substring(0, 100)}`,
              );
            }
          }
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

        if (!fragment) {
          throw new Error(`No fragment named ${selection.name.value}.`);
        }
      }

      let matches = true;
      if (context.fragmentMatcherFunction && fragment.typeCondition) {
        // TODO we need to rewrite the fragment matchers for this to work properly and efficiently
        // Right now we have to pretend that we're passing in an idValue and that there's a store
        // on the context.
        const idValue = toIdValue({ id: 'self', typename: undefined });
        const fakeContext: ReadStoreContext = {
          // NOTE: fakeContext always uses ObjectCache
          // since this is only to ensure the return value of 'matches'
          store: new ObjectCache({ self: result }),
          returnPartialData: false,
          hasMissingField: false,
          cacheRedirects: {},
        };
        matches = context.fragmentMatcherFunction(
          idValue,
          fragment.typeCondition.name.value,
          fakeContext,
        );
        if (!isProduction() && fakeContext.returnPartialData) {
          console.error('WARNING: heuristic fragment matching going on!');
        }
      }

      if (included && matches) {
        writeSelectionSetToStore({
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

// Checks if the id given is an id that was generated by Apollo
// rather than by dataIdFromObject.
function isGeneratedId(id: string): boolean {
  return id[0] === '$';
}

function mergeWithGenerated(
  generatedKey: string,
  realKey: string,
  cache: NormalizedCache,
) {
  const generated = cache.get(generatedKey);
  const real = cache.get(realKey);

  Object.keys(generated).forEach(key => {
    const value = generated[key];
    const realValue = real[key];
    if (isIdValue(value) && isGeneratedId(value.id) && isIdValue(realValue)) {
      mergeWithGenerated(value.id, realValue.id, cache);
    }
    cache.delete(generatedKey);
    cache.set(realKey, { ...generated, ...real } as StoreObject);
  });
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

function writeFieldToStore({
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
  // specifies if we need to merge existing keys in the store
  let shouldMerge = false;
  // If we merge, this will be the generatedKey
  let generatedKey: string = '';

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

    storeValue = processArrayValue(
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
      if (semanticId && isGeneratedId(semanticId)) {
        throw new Error(
          'IDs returned by dataIdFromObject cannot begin with the "$" character.',
        );
      }

      if (semanticId) {
        valueDataId = semanticId;
        generated = false;
      }
    }

    if (!isDataProcessed(valueDataId, field, context.processedData)) {
      writeSelectionSetToStore({
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
      if (generated && !escapedId.generated && !typenameChanged) {
        throw new Error(
          `Store error: the application attempted to write an object with no provided id` +
            ` but the store already contains an id of ${
              escapedId.id
            } for this object. The selectionSet` +
            ` that was trying to be written is:\n` +
            print(field),
        );
      }
      // checks if we "lost" the typename
      if (hadTypename && !hasTypename) {
        throw new Error(
          `Store error: the application attempted to write an object with no provided typename` +
            ` but the store already contains an object with typename of ${
              escapedId.typename
            } for the object of id ${escapedId.id}. The selectionSet` +
            ` that was trying to be written is:\n` +
            print(field),
        );
      }

      if (escapedId.generated) {
        generatedKey = escapedId.id;
        // we should only merge if it's an object of the same type
        // otherwise, we should delete the generated object
        if (typenameChanged) {
          store.delete(generatedKey);
        } else {
          shouldMerge = true;
        }
      }
    }
  }

  const newStoreObj = {
    ...store.get(dataId),
    [storeFieldName]: storeValue,
  } as StoreObject;

  if (shouldMerge) {
    mergeWithGenerated(generatedKey, (storeValue as IdValue).id, store);
  }

  storeObject = store.get(dataId);
  if (!storeObject || storeValue !== storeObject[storeFieldName]) {
    store.set(dataId, newStoreObj);
  }
}

function processArrayValue(
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
      return processArrayValue(item, itemDataId, selectionSet, context);
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
      writeSelectionSetToStore({
        dataId: itemDataId,
        result: item,
        selectionSet,
        context,
      });
    }

    return toIdValue({ id: itemDataId, typename: item.__typename }, generated);
  });
}
