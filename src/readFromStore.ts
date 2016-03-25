import {
  parseFragment,
  parseQuery,
} from './parser';

import {
  diffSelectionSetAgainstStore,
} from './diffAgainstStore';

import {
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
  query: string
}): Object {
  const queryDef = parseQuery(query);

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
}: { store: Store, fragment: string, rootId: string }): Object {
  const fragmentDef = parseFragment(fragment);

  return readSelectionSetFromStore({
    store,
    rootId,
    selectionSet: fragmentDef.selectionSet,
  });
}

export function readSelectionSetFromStore({
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
