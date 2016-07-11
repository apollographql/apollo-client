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
} from './store';

// import {
//   printAST,
// } from './debug';

export function readQueryFromStore({
  store,
  query,
  variables,
  returnPartialData,
  noFetch,
}: {
  store: NormalizedCache,
  query: Document,
  variables?: Object,
  returnPartialData?: boolean,
  noFetch?: boolean,
}): Object {
  const queryDef = getQueryDefinition(query);

  return readSelectionSetFromStore({
    store,
    rootId: 'ROOT_QUERY',
    selectionSet: queryDef.selectionSet,
    variables,
    returnPartialData,
    noFetch,
  });
}

export function readFragmentFromStore({
  store,
  fragment,
  rootId,
  variables,
  returnPartialData,
  noFetch,
}: {
  store: NormalizedCache,
  fragment: Document,
  rootId: string,
  variables?: Object,
  returnPartialData?: boolean,
  noFetch?: boolean,
}): Object {
  const fragmentDef = getFragmentDefinition(fragment);

  return readSelectionSetFromStore({
    store,
    rootId,
    selectionSet: fragmentDef.selectionSet,
    variables,
    returnPartialData,
    noFetch,
  });
}

export function readSelectionSetFromStore({
  store,
  rootId,
  selectionSet,
  variables,
  returnPartialData = false,
  noFetch = false,
  fragmentMap,
}: {
  store: NormalizedCache,
  rootId: string,
  selectionSet: SelectionSet,
  variables: Object,
  returnPartialData?: boolean,
  noFetch?: boolean,
  fragmentMap?: FragmentMap,
}): Object {
  const {
    result,
  } = diffSelectionSetAgainstStore({
    selectionSet,
    rootId,
    store,
    throwOnMissingField: !returnPartialData && !noFetch,
    variables,
    fragmentMap,
  });

  return result;
}
