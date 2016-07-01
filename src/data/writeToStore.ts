import isArray = require('lodash.isarray');
import isNull = require('lodash.isnull');
import isUndefined = require('lodash.isundefined');
import assign = require('lodash.assign');

import {
  getQueryDefinition,
  getFragmentDefinition,
  FragmentMap,
} from '../queries/getFromAST';

import {
  storeKeyNameFromField,
  resultKeyNameFromField,
  isField,
  isInlineFragment,
} from './storeUtils';

import {
  diffFieldAgainstStore,
} from './diffAgainstStore';

import {
  OperationDefinition,
  SelectionSet,
  FragmentDefinition,
  Field,
  Document,
} from 'graphql';

import {
  NormalizedCache,
  StoreObject,
} from './store';

import {
  IdGetter,
} from './extensions';

import {
  shouldInclude,
} from '../queries/directives';

import { MergeResultsType } from '../QueryManager';

// import {
//   printAST,
// } from './debug';

/**
 * Convert a nested GraphQL result into a normalized store, where each object from the schema
 * appears exactly once.
 * @param  {Object} result Arbitrary nested JSON, returned from the GraphQL server
 * @param  {String} [fragment] The GraphQL fragment used to fetch the data in result
 * @param  {SelectionSet} [selectionSet] The parsed selection set for the subtree of the query this
 *                                       result represents
 * @param  {Object} [store] The store to merge into
 * @return {Object} The resulting store
 */
export function writeFragmentToStore({
  result,
  fragment,
  store = {} as NormalizedCache,
  variables,
  dataIdFromObject = null,
  quietArguments,
  fetchMore,
  mergeResults,
  targetedFetchMoreDirectives,
}: {
  result: Object,
  fragment: Document,
  store?: NormalizedCache,
  variables?: Object,
  dataIdFromObject?: IdGetter,
  quietArguments?: string[],
  fetchMore?: boolean,
  mergeResults?: MergeResultsType,
  targetedFetchMoreDirectives?: string[],
}): NormalizedCache {
  // Argument validation
  if (!fragment) {
    throw new Error('Must pass fragment.');
  }

  const parsedFragment: FragmentDefinition = getFragmentDefinition(fragment);
  const selectionSet: SelectionSet = parsedFragment.selectionSet;

  if (!result['id']) {
    throw new Error('Result must have id when writing fragment to store.');
  }

  return writeSelectionSetToStore({
    dataId: result['id'],
    result,
    selectionSet,
    store,
    variables,
    dataIdFromObject,
    quietArguments,
    fetchMore,
    mergeResults,
    targetedFetchMoreDirectives,
  });
}

export function writeQueryToStore({
  result,
  query,
  store = {} as NormalizedCache,
  variables,
  dataIdFromObject = null,
  quietArguments,
  fetchMore,
  mergeResults,
  targetedFetchMoreDirectives,
}: {
  result: Object,
  query: Document,
  store?: NormalizedCache,
  variables?: Object,
  dataIdFromObject?: IdGetter,
  quietArguments?: string[],
  fetchMore?: boolean,
  mergeResults?: MergeResultsType,
  targetedFetchMoreDirectives?: string[],
}): NormalizedCache {
  const queryDefinition: OperationDefinition = getQueryDefinition(query);

  return writeSelectionSetToStore({
    dataId: 'ROOT_QUERY',
    result,
    selectionSet: queryDefinition.selectionSet,
    store,
    variables,
    dataIdFromObject,
    quietArguments,
    fetchMore,
    mergeResults,
    targetedFetchMoreDirectives,
  });
}

export function writeSelectionSetToStore({
  result,
  dataId,
  selectionSet,
  store = {} as NormalizedCache,
  variables,
  dataIdFromObject,
  fragmentMap,
  quietArguments,
  fetchMore,
  mergeResults,
  targetedFetchMoreDirectives,
}: {
  dataId: string,
  result: any,
  selectionSet: SelectionSet,
  store?: NormalizedCache,
  variables: Object,
  dataIdFromObject: IdGetter,
  fragmentMap?: FragmentMap,
  quietArguments?: string[],
  fetchMore?: boolean,
  mergeResults?: MergeResultsType,
  targetedFetchMoreDirectives?: string[],
}): NormalizedCache {

  if (!fragmentMap) {
    //we have an empty sym table if there's no sym table given
    //to us for the fragments.
    fragmentMap = {};
  }

  selectionSet.selections.forEach((selection) => {
    if (isField(selection)) {
      const resultFieldKey: string = resultKeyNameFromField(selection);
      const value: any = result[resultFieldKey];
      const included = shouldInclude(selection, variables);

      if (isUndefined(value) && included) {
        throw new Error(`Can't find field ${resultFieldKey} on result object ${dataId}.`);
      }

      if (!isUndefined(value) && !included) {
        throw new Error(`Found extra field ${resultFieldKey} on result object ${dataId}.`);
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
          quietArguments,
          fetchMore,
          mergeResults,
          targetedFetchMoreDirectives,
        });
      }
    } else if (isInlineFragment(selection)) {
      // XXX what to do if this tries to write the same fields? Also, type conditions...
      writeSelectionSetToStore({
        result,
        selectionSet: selection.selectionSet,
        store,
        variables,
        dataId,
        dataIdFromObject,
        fragmentMap,
        quietArguments,
        fetchMore,
        mergeResults,
        targetedFetchMoreDirectives,
      });
    } else {
      //look up the fragment referred to in the selection
      const fragment = fragmentMap[selection.name.value];
      if (!fragment) {
        throw new Error(`No fragment named ${selection.name.value}.`);
      }

      writeSelectionSetToStore({
        result,
        selectionSet: fragment.selectionSet,
        store,
        variables,
        dataId,
        dataIdFromObject,
        fragmentMap,
        quietArguments,
        fetchMore,
        mergeResults,
        targetedFetchMoreDirectives,
      });

      //throw new Error('Non-inline fragments not supported.');
    }
  });

  return store;
}

function writeFieldToStore({
  field,
  value,
  variables,
  store,
  dataId,
  dataIdFromObject,
  fragmentMap,
  quietArguments,
  fetchMore,
  mergeResults,
  targetedFetchMoreDirectives,
}: {
  field: Field,
  value: any,
  variables: {},
  store: NormalizedCache,
  dataId: string,
  dataIdFromObject: IdGetter,
  fragmentMap?: FragmentMap,
  quietArguments?: string[],
  fetchMore?: boolean,
  mergeResults?: MergeResultsType,
  targetedFetchMoreDirectives?: string[],
}) {
  let storeValue;

  const storeFieldName: string = storeKeyNameFromField(field, variables, quietArguments);

  // If it's a scalar, just store it in the store
  if (!field.selectionSet || isNull(value)) {
    storeValue = value;
  } else if (isArray(value)) {
    // this is an array with sub-objects
    let thisIdList: Array<string> = [];
    // If we're fetching more, append/prepend existing values
    const fetchMoreDirective = field.directives
    .filter(dir => dir.name.value === 'apolloFetchMore')[0] || null;
    if (fetchMore && fetchMoreDirective) {
      const {
        result: currentlyStoredValues,
      } = diffFieldAgainstStore({
        field,
        throwOnMissingField: false,
        variables,
        rootId: dataId,
        store,
        fragmentMap,
        included: true,
        quietArguments,
      });
      // TODO: use the right merging function
      if (fetchMore) {
        value = [].concat(currentlyStoredValues, value);
      }
    }

    value.forEach((item, index) => {
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
          quietArguments,
          fetchMore,
          mergeResults,
          targetedFetchMoreDirectives,
        });
      }
    });

    storeValue = thisIdList;
  } else {
    // It's an object
    let valueDataId = `${dataId}.${storeFieldName}`;

    if (dataIdFromObject) {
      const semanticId = dataIdFromObject(value);

      if (semanticId) {
        valueDataId = semanticId;
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
      quietArguments,
      fetchMore,
      mergeResults,
      targetedFetchMoreDirectives,
    });

    storeValue = valueDataId;
  }

  const newStoreObj = assign({}, store[dataId], {
    [storeFieldName]: storeValue,
  }) as StoreObject;

  store[dataId] = newStoreObj;
}
