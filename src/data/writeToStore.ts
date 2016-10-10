import isArray = require('lodash.isarray');
import isNull = require('lodash.isnull');
import isUndefined = require('lodash.isundefined');
import isObject = require('lodash.isobject');
import assign = require('lodash.assign');

import {
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
  OperationDefinition,
  SelectionSet,
  Field,
  Document,
} from 'graphql';

import {
  NormalizedCache,
  StoreObject,
  IdValue,
  isIdValue,
} from './store';

import {
  handleFragmentErrors,
} from './diffAgainstStore';

import {
  IdGetter,
} from './extensions';

import {
  shouldInclude,
} from '../queries/directives';

import {
  ApolloError,
} from '../errors/ApolloError';

/**
 * Writes the result of a query to the store.
 *
 * @param query The query document whose result we are writing to the store.
 *
 * @param result The result object returned for the query document.
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
 */
export function writeQueryToStore({
  result,
  query,
  store = {} as NormalizedCache,
  variables,
  dataIdFromObject = null,
  fragmentMap,
}: {
  result: Object,
  query: Document,
  store?: NormalizedCache,
  variables?: Object,
  dataIdFromObject?: IdGetter,
  fragmentMap?: FragmentMap,
}): NormalizedCache {
  const queryDefinition: OperationDefinition = getQueryDefinition(query);

  return writeSelectionSetToStore({
    dataId: 'ROOT_QUERY',
    result,
    selectionSet: queryDefinition.selectionSet,
    store,
    variables,
    dataIdFromObject,
    fragmentMap,
  });
}

export function writeResultToStore({
  result,
  dataId,
  document,
  store = {} as NormalizedCache,
  variables,
  dataIdFromObject,
}: {
  dataId: string,
  result: any,
  document: Document,
  store?: NormalizedCache,
  variables: Object,
  dataIdFromObject: IdGetter,
}): NormalizedCache {

  // XXX TODO REFACTOR: this is a temporary workaround until query normalization is made to work with documents.
  const selectionSet = getOperationDefinition(document).selectionSet;
  const fragmentMap = createFragmentMap(getFragmentDefinitions(document));

  return writeSelectionSetToStore({
    result,
    dataId,
    selectionSet,
    store,
    variables,
    dataIdFromObject,
    fragmentMap,
  })
}

export function writeSelectionSetToStore({
  result,
  dataId,
  selectionSet,
  store = {} as NormalizedCache,
  variables,
  dataIdFromObject,
  fragmentMap,
}: {
  dataId: string,
  result: any,
  selectionSet: SelectionSet,
  store?: NormalizedCache,
  variables: Object,
  dataIdFromObject: IdGetter,
  fragmentMap?: FragmentMap,
}): NormalizedCache {

  if (!fragmentMap) {
    //we have an empty sym table if there's no sym table given
    //to us for the fragments.
    fragmentMap = {};
  }

  let fragmentErrors: { [typename: string]: Error } = {};
  selectionSet.selections.forEach((selection) => {
    const included = shouldInclude(selection, variables);

    if (isField(selection)) {
      const resultFieldKey: string = resultKeyNameFromField(selection);
      const value: any = result[resultFieldKey];

      // In both of these cases, we add some extra information to the error
      // that allows us to use fragmentErrors correctly. Since the ApolloError type
      // derives from the Javascript Error type, the end-user doesn't notice the
      // fact that we're doing this.
      if (isUndefined(value) && included) {
        throw new ApolloError({
          errorMessage: `Can't find field ${resultFieldKey} on result object ${dataId}.`,
          extraInfo: {
            isFieldError: true,
          },
        });
      }

      if (!isUndefined(value) && !included) {
        throw new ApolloError({
          errorMessage: `Found extra field ${resultFieldKey} on result object ${dataId}.`,
          extraInfo: {
            isFieldError: true,
          },
        });
      }

      if (!isUndefined(value)) {
        writeFieldToStore({
          dataId,
          value,
          variables,
          store,
          field: selection,
          dataIdFromObject,
          fragmentMap,
        });
      }
    } else if (isInlineFragment(selection)) {
      const typename = selection.typeCondition.name.value;

      if (included) {
        try {
          // XXX what to do if this tries to write the same fields? Also, type conditions...
          writeSelectionSetToStore({
            result,
            selectionSet: selection.selectionSet,
            store,
            variables,
            dataId,
            dataIdFromObject,
            fragmentMap,
          });

          if (!fragmentErrors[typename]) {
            fragmentErrors[typename] = null;
          }
        } catch (e) {
          if (e.extraInfo && e.extraInfo.isFieldError) {
            fragmentErrors[typename] = e;
          } else {
            throw e;
          }
        }
      }
    } else {
      //look up the fragment referred to in the selection
      const fragment = fragmentMap[selection.name.value];

      if (!fragment) {
        throw new Error(`No fragment named ${selection.name.value}.`);
      }

      const typename = fragment.typeCondition.name.value;

      if (included) {
        try {
          writeSelectionSetToStore({
            result,
            selectionSet: fragment.selectionSet,
            store,
            variables,
            dataId,
            dataIdFromObject,
            fragmentMap,
          });

          if (!fragmentErrors[typename]) {
            fragmentErrors[typename] = null;
          }
        } catch (e) {
          if (e.extraInfo && e.extraInfo.isFieldError) {
            fragmentErrors[typename] = e;
          } else {
            throw e;
          }
        }
      }
    }
  });

  handleFragmentErrors(fragmentErrors);

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
    cache[realKey] = assign({}, generated, real) as StoreObject;
  });
}

function writeFieldToStore({
  field,
  value,
  variables,
  store,
  dataId,
  dataIdFromObject,
  fragmentMap,
}: {
  field: Field,
  value: any,
  variables: {},
  store: NormalizedCache,
  dataId: string,
  dataIdFromObject: IdGetter,
  fragmentMap?: FragmentMap,
}) {
  let storeValue: any;

  const storeFieldName: string = storeKeyNameFromField(field, variables);
  // specifies if we need to merge existing keys in the store
  let shouldMerge = false;
  // If we merge, this will be the generatedKey
  let generatedKey: string;

  // If it's a scalar that's not a JSON blob, just store it in the store
  if ((!field.selectionSet || isNull(value)) && !isObject(value)) {
    storeValue = value;
  } else if ((!field.selectionSet || isNull(value)) && isObject(value)) {
    // If it is a scalar that's a JSON blob, we have to "escape" it so it can't
    // pretend to be an id
    storeValue = {
      type: 'json',
      json: value,
    };
  } else if (isArray(value)) {
    // this is an array with sub-objects
    const thisIdList: Array<string> = [];

    value.forEach((item: any, index: any) => {
      if (isNull(item)) {
        thisIdList.push(null);
      } else {
        let itemDataId = `${dataId}.${storeFieldName}.${index}`;

        if (dataIdFromObject) {
          const semanticId = dataIdFromObject(item);

          if (semanticId) {
            itemDataId = semanticId;
          }
        }

        thisIdList.push(itemDataId);

        writeSelectionSetToStore({
          dataId: itemDataId,
          result: item,
          store,
          selectionSet: field.selectionSet,
          variables,
          dataIdFromObject,
          fragmentMap,
        });
      }
    });

    storeValue = thisIdList;
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
      store,
      selectionSet: field.selectionSet,
      variables,
      dataIdFromObject,
      fragmentMap,
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
        throw new ApolloError({
          errorMessage: `Store error: the application attempted to write an object with no provided id` +
            ` but the store already contains an id of ${escapedId.id} for this object.`,
        });
      }

      if (isIdValue(escapedId) && escapedId.generated) {
        generatedKey = escapedId.id;
        shouldMerge = true;
      }
    }
  }

  const newStoreObj = assign({}, store[dataId], {
    [storeFieldName]: storeValue,
  }) as StoreObject;

  if (shouldMerge) {
    mergeWithGenerated(generatedKey, (storeValue as IdValue).id, store);
  }
  if (!store[dataId] || storeValue !== store[dataId][storeFieldName]) {
    store[dataId] = newStoreObj;
  }

}
