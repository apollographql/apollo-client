import {
  diffSelectionSetAgainstStore,
} from './diffAgainstStore';

import {
  SelectionSet,
  Document,
} from 'graphql';

import {
  getQueryDefinition,
  getFragmentDefinition,
  FragmentMap,
} from '../queries/getFromAST';

import {
  NormalizedCache,
  isIdValue,
  isJsonValue,
  IdValue,
  JsonValue,
} from './store';

import isObject = require('lodash.isobject');
import isArray = require('lodash.isarray');

// Read an object from the store given that object's id.
// This function performs a deep read, i.e. it will read the fields of the object
// from the normalized store structure as well.
export function readObjectByIdFromStore({
  store,
  id,
}: {
  store: NormalizedCache,
  id: string,
}): any {
  const value = store[id];
  if (isObject(value)) {
    // If this is an object, it must have other properties that we have to
    // read in as well.
    Object.keys(value).forEach((key) => {
      const insideValue = value[key];
      if (isIdValue(insideValue)) {
        value[key] = readObjectByIdFromStore({ store, id: (insideValue as IdValue).id });
      } else if (isArray(insideValue)) {
        // If this is an array, we have to recursively read each of the ids.
        value[key] = insideValue.map((idVal) => {
          return readObjectByIdFromStore({ store, id: idVal });
        });
      } else if (isJsonValue(insideValue)) {
        value[key] = (insideValue as JsonValue).json;
      }
    });
  }

  return value;
}


export function readQueryFromStore({
  store,
  query,
  variables,
  returnPartialData,
  fragmentMap,
}: {
  store: NormalizedCache,
  query: Document,
  variables?: Object,
  returnPartialData?: boolean,
  fragmentMap?: FragmentMap,
}): Object {
  const queryDef = getQueryDefinition(query);

  return readSelectionSetFromStore({
    store,
    rootId: 'ROOT_QUERY',
    selectionSet: queryDef.selectionSet,
    variables,
    returnPartialData,
    fragmentMap,
  });
}

export function readFragmentFromStore({
  store,
  fragment,
  rootId,
  variables,
  returnPartialData,
}: {
  store: NormalizedCache,
  fragment: Document,
  rootId: string,
  variables?: Object,
  returnPartialData?: boolean,
}): Object {
  const fragmentDef = getFragmentDefinition(fragment);

  return readSelectionSetFromStore({
    store,
    rootId,
    selectionSet: fragmentDef.selectionSet,
    variables,
    returnPartialData,
  });
}

export function readSelectionSetFromStore({
  store,
  rootId,
  selectionSet,
  variables,
  returnPartialData = false,
  fragmentMap,
}: {
  store: NormalizedCache,
  rootId: string,
  selectionSet: SelectionSet,
  variables: Object,
  returnPartialData?: boolean,
  fragmentMap?: FragmentMap,
}): Object {
  const {
    result,
  } = diffSelectionSetAgainstStore({
    selectionSet,
    rootId,
    store,
    throwOnMissingField: !returnPartialData,
    variables,
    fragmentMap,
  });

  return result;
}
