
import {
  getDefaultValues,
  getOperationDefinition,
  getQueryDefinition,
  FragmentMap,
  getFragmentDefinitions,
  createFragmentMap,
} from '../queries/getFromAST';

import {
  storeKeyNameFromField,
  resultKeyNameFromField,
  isField,
  isInlineFragment,
} from './storeUtils';

import {
  ReadStoreContext,
} from '../data/readFromStore';

import {
  OperationDefinitionNode,
  SelectionSetNode,
  FieldNode,
  DocumentNode,
  InlineFragmentNode,
  FragmentDefinitionNode,
} from 'graphql';

import {
  FragmentMatcher,
} from 'graphql-anywhere';

import {
  NormalizedCache,
  StoreObject,
  IdValue,
  isIdValue,
} from './storeUtils';

import {
  IdGetter,
} from '../core/types';

import {
  shouldInclude,
} from '../queries/directives';

import {
  isProduction,
} from '../util/environment';

import {
  assign,
} from '../util/assign';

class WriteError extends Error {
  public type = 'WriteError';
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
  store = {} as NormalizedCache,
  variables,
  dataIdFromObject,
  fragmentMap = {} as FragmentMap,
  fragmentMatcherFunction,
}: {
  result: Object,
  query: DocumentNode,
  store?: NormalizedCache,
  variables?: Object,
  dataIdFromObject?: IdGetter,
  fragmentMap?: FragmentMap,
  fragmentMatcherFunction?: FragmentMatcher,
}): NormalizedCache {
  const queryDefinition: OperationDefinitionNode = getQueryDefinition(query);

  variables = assign({}, getDefaultValues(queryDefinition), variables);

  return writeSelectionSetToStore({
    dataId: 'ROOT_QUERY',
    result,
    selectionSet: queryDefinition.selectionSet,
    context: {
      store,
      variables,
      dataIdFromObject,
      fragmentMap,
      fragmentMatcherFunction,
    },
  });
}

export type WriteContext = {
  store: NormalizedCache;
  variables?: any;
  dataIdFromObject?: IdGetter;
  fragmentMap?: FragmentMap;
  fragmentMatcherFunction?: FragmentMatcher;
};

export function writeResultToStore({
  dataId,
  result,
  document,
  store = {} as NormalizedCache,
  variables,
  dataIdFromObject,
  fragmentMatcherFunction,
}: {
  dataId: string,
  result: any,
  document: DocumentNode,
  store?: NormalizedCache,
  variables?: Object,
  dataIdFromObject?: IdGetter,
  fragmentMatcherFunction?: FragmentMatcher,
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
        variables,
        dataIdFromObject,
        fragmentMap,
        fragmentMatcherFunction,
      },
    });
  } catch (e) {
    // XXX A bit hacky maybe ...
    const e2 = new Error(`Error writing result to store for query ${document.loc && document.loc.source.body}`);
    e2.message += '/n' + e.message;
    e2.stack = e.stack;
    throw e2;
  }
}

export function writeSelectionSetToStore({
  result,
  dataId,
  selectionSet,
  context,
}: {
  dataId: string,
  result: any,
  selectionSet: SelectionSetNode,
  context: WriteContext,
}): NormalizedCache {
  const { variables, store, dataIdFromObject, fragmentMap } = context;

  selectionSet.selections.forEach((selection) => {
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
          if (context.fragmentMatcherFunction) {
            // XXX We'd like to throw an error, but for backwards compatibility's sake
            // we just print a warning for the time being.
            //throw new WriteError(`Missing field ${resultFieldKey}`);
            if (!isProduction()) {
              console.warn(`Missing field ${resultFieldKey}`);
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
        const idValue: IdValue = { type: 'id', id: 'self', generated: false };
        const fakeContext: ReadStoreContext = {
          store: { 'self': result },
          returnPartialData: false,
          hasMissingField: false,
          customResolvers: {},
        };
        matches = context.fragmentMatcherFunction(
          idValue,
          fragment.typeCondition.name.value,
          fakeContext,
        );
        if (fakeContext.returnPartialData) {
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
  return (id[0] === '$');
}

function mergeWithGenerated(generatedKey: string, realKey: string, cache: NormalizedCache) {
  const generated = cache[generatedKey];
  const real = cache[realKey];

  Object.keys(generated).forEach((key) => {
    const value = generated[key];
    const realValue = real[key];
    if (isIdValue(value)
        && isGeneratedId(value.id)
        && isIdValue(realValue)) {
      mergeWithGenerated(value.id, realValue.id, cache);
    }
    delete cache[generatedKey];
    cache[realKey] = { ...generated, ...real } as StoreObject;
  });
}

function writeFieldToStore({
  field,
  value,
  dataId,
  context,
}: {
  field: FieldNode,
  value: any,
  dataId: string,
  context: WriteContext,
}) {
  const { variables, dataIdFromObject, store, fragmentMap } = context;

  let storeValue: any;

  const storeFieldName: string = storeKeyNameFromField(field, variables);
  // specifies if we need to merge existing keys in the store
  let shouldMerge = false;
  // If we merge, this will be the generatedKey
  let generatedKey: string = '';

  // If this is a scalar value...
  if (!field.selectionSet || value === null) {
    storeValue =
      value != null && typeof value === 'object'
        // If the scalar value is a JSON blob, we have to "escape" it so it can’t pretend to be
        // an id.
        ? { type: 'json', json: value }
        // Otherwise, just store the scalar directly in the store.
        : value;
  } else if (Array.isArray(value)) {
    const generatedId = `${dataId}.${storeFieldName}`;

    storeValue = processArrayValue(value, generatedId, field.selectionSet, context);
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
        throw new Error('IDs returned by dataIdFromObject cannot begin with the "$" character.');
      }

      if (semanticId) {
        valueDataId = semanticId;
        generated = false;
      }
    }

    writeSelectionSetToStore({
      dataId: valueDataId,
      result: value,
      selectionSet: field.selectionSet,
      context,
    });

    // We take the id and escape it (i.e. wrap it with an enclosing object).
    // This allows us to distinguish IDs from normal scalars.
    storeValue = {
      type: 'id',
      id: valueDataId,
      generated,
    };

    // check if there was a generated id at the location where we're
    // about to place this new id. If there was, we have to merge the
    // data from that id with the data we're about to write in the store.
    if (store[dataId] && store[dataId][storeFieldName] !== storeValue) {
      const escapedId = store[dataId][storeFieldName] as IdValue;

      // If there is already a real id in the store and the current id we
      // are dealing with is generated, we throw an error.
      if (isIdValue(storeValue) && storeValue.generated
          && isIdValue(escapedId) && !escapedId.generated) {
        throw new Error(`Store error: the application attempted to write an object with no provided id` +
            ` but the store already contains an id of ${escapedId.id} for this object.`);
      }

      if (isIdValue(escapedId) && escapedId.generated) {
        generatedKey = escapedId.id;
        shouldMerge = true;
      }
    }
  }

  const newStoreObj = {
    ...store[dataId],
    [storeFieldName]: storeValue,
  } as StoreObject;

  if (shouldMerge) {
    mergeWithGenerated(generatedKey, (storeValue as IdValue).id, store);
  }

  if (!store[dataId] || storeValue !== store[dataId][storeFieldName]) {
    store[dataId] = newStoreObj;
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

    writeSelectionSetToStore({
      dataId: itemDataId,
      result: item,
      selectionSet,
      context,
    });

    const idStoreValue: IdValue = {
      type: 'id',
      id: itemDataId,
      generated,
    };

    return idStoreValue;
  });
}
