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
  SelectionSet,
} from 'graphql';

import {
  Store,
} from './store';

// import {
//   printAST,
// } from './debug';

export function readQueryFromStore({ store, query }: {
  store: Store,
  query: Document | string
}): Object {
  const queryDef = parseQueryIfString(query);

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
}: { store: Store, fragment: Document | string, rootId: string }): Object {
  const fragmentDef = parseFragmentIfString(fragment);

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
}: {store: Store, rootId: string, selectionSet: SelectionSet }): Object {
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
