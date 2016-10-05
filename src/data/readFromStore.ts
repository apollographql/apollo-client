import {
  diffQueryAgainstStore,
} from './diffAgainstStore';

import {
  SelectionSet,
  Document,
  OperationDefinition,
  FragmentDefinition,
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

/**
 * Resolves the result of a query solely from the store (i.e. never hits the server).
 *
 * @param store The {@link NormalizedCache} used by Apollo for the `data` portion of the store.
 *
 * @param query The query document to resolve from the data available in the store.
 *
 * @param variables A map from the name of a variable to its value. These variables can be
 * referenced by the query document.
 *
 * @param returnPartialData If set to true, the query will be resolved even if all of the data
 * needed to resolve the query is not found in the store. The data keys that are not found will not
 * be present in the returned object. If set to false, an error will be thrown if there are fields
 * that cannot be resolved from the store.
 *
 * @param fragmentMap A map from the name of a fragment to its fragment definition. These fragments
 * can be referenced within the query document.
 */
export function readQueryFromStore({
  store,
  query,
  variables,
  returnPartialData = false,
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
  const query = makeDocument(selectionSet, rootId, fragmentMap);

  const {
    result,
  } = diffQueryAgainstStore({
    query,
    store,
    throwOnMissingField: !returnPartialData,
    variables,
  });

  return result;
}


// Shim to use graphql-anywhere, to be removed
function makeDocument(
  selectionSet: SelectionSet,
  rootId: string,
  fragmentMap: FragmentMap
): Document {
  if (rootId !== 'ROOT_QUERY') {
    throw new Error('only supports query');
  }

  const op: OperationDefinition = {
    kind: 'OperationDefinition',
    operation: 'query',
    selectionSet,
  };

  const frags: FragmentDefinition[] = fragmentMap ?
    Object.keys(fragmentMap).map((name) => fragmentMap[name]) :
    [];

  const doc: Document = {
    kind: 'Document',
    definitions: [op, ...frags],
  };

  return doc;
}
