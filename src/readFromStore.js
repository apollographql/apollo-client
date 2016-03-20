import {
  parseFragmentIfString,
  parseQueryIfString,
} from './parser';

import {
  diffSelectionSetAgainstStore,
} from './diffAgainstStore';

// import {
//   printAST,
// } from './debug';

export function readQueryFromStore({ store, query }) {
  const queryDef = parseQueryIfString(query);

  return readSelectionSetFromStore({
    store,
    rootId: 'ROOT_QUERY',
    selectionSet: queryDef.selectionSet,
  });
}

export function readFragmentFromStore({ store, fragment, rootId }) {
  const fragmentDef = parseFragmentIfString(fragment);

  return readSelectionSetFromStore({
    store,
    rootId,
    selectionSet: fragmentDef.selectionSet,
  });
}

function readSelectionSetFromStore({ store, rootId, selectionSet }) {
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
