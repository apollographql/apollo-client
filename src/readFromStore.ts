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

export function readQueryFromStore({
  store,
  query,
  variables,
}: {
  store: Store,
  query: string,
  variables?: Object,
}): Object {
  const queryDef = parseQuery(query);

  return readSelectionSetFromStore({
    store,
    rootId: 'ROOT_QUERY',
    selectionSet: queryDef.selectionSet,
    variables,
  });
}

export function readFragmentFromStore({
  store,
  fragment,
  rootId,
  variables,
}: {
  store: Store,
  fragment: string,
  rootId: string,
  variables?: Object,
}): Object {
  const fragmentDef = parseFragment(fragment);

  return readSelectionSetFromStore({
    store,
    rootId,
    selectionSet: fragmentDef.selectionSet,
    variables,
  });
}

export function readSelectionSetFromStore({
  store,
  rootId,
  selectionSet,
  variables,
}: {
  store: Store,
  rootId: string,
  selectionSet: SelectionSet,
  variables: Object,
}): Object {
  const {
    result,
  } = diffSelectionSetAgainstStore({
    selectionSet,
    rootId,
    store,
    throwOnMissingField: true,
    variables,
  });

  return result;
}
