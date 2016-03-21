/// <reference path="../typings/browser/ambient/es6-promise/index.d.ts" />
/// <reference path="../typings/browser/ambient/graphql/index.d.ts" />
/// <reference path="../typings/browser/definitions/lodash/index.d.ts" />

import {
  parseFragmentIfString,
  parseQueryIfString,
} from './parser';

import {
  diffSelectionSetAgainstStore,
} from './diffAgainstStore';

import {
  Document,
  OperationDefinition,
  FragmentDefinition,
  SelectionSet,
} from 'graphql';

// import {
//   printAST,
// } from './debug';

export function readQueryFromStore({ store, query }: {
  store: Object,
  query: Document | string
}): Object {
  const queryDef: OperationDefinition = parseQueryIfString(query);

  return readSelectionSetFromStore({
    store,
    rootId: 'ROOT_QUERY',
    selectionSet: queryDef.selectionSet,
  });
}

export function readFragmentFromStore({
    store,
    fragment,
    rootId,
}: { store: Object, fragment: Document | string, rootId: string }): Object {
  const fragmentDef: FragmentDefinition = parseFragmentIfString(fragment);

  return readSelectionSetFromStore({
    store,
    rootId,
    selectionSet: fragmentDef.selectionSet,
  });
}

function readSelectionSetFromStore({
    store,
    rootId,
    selectionSet,
}: {store: Object, rootId: string, selectionSet: SelectionSet }): Object {
  const {
    result,
  } = diffSelectionSetAgainstStore({
    selectionSet,
    rootId,
    store,
    throwOnMissingField: true,
  });

  return result;
}
