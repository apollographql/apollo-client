import {
  diffSelectionSetAgainstStore,
  StoreContext,
} from './diffAgainstStore';

import {
  SelectionSet,
  Document,
} from 'graphql';

import {
  getQueryDefinition,
  getFragmentDefinition,
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
}: {
  store: NormalizedCache,
  query: Document,
  variables?: Object,
  returnPartialData?: boolean,
}): Object {
  const queryDef = getQueryDefinition(query);

  return readSelectionSetFromStore({
    context: { store, fragmentMap: {} },
    rootId: 'ROOT_QUERY',
    selectionSet: queryDef.selectionSet,
    variables,
    returnPartialData,
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
    context: { store, fragmentMap: {} },
    rootId,
    selectionSet: fragmentDef.selectionSet,
    variables,
    returnPartialData,
  });
}

export function readSelectionSetFromStore({
  context,
  rootId,
  selectionSet,
  variables,
  returnPartialData = false,
}: {
  context: StoreContext,
  rootId: string,
  selectionSet: SelectionSet,
  variables: Object,
  returnPartialData?: boolean,
}): Object {
  const {
    result,
  } = diffSelectionSetAgainstStore({
    context,
    selectionSet,
    rootId,
    throwOnMissingField: !returnPartialData,
    variables,
  });

  return result;
}
