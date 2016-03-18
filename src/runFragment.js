import {
  isArray,
  has,
} from 'lodash';

import {
  parseFragmentIfString,
  parseQueryIfString,
} from './parser';

import {
  cacheFieldNameFromSelection,
  resultFieldNameFromSelection,
} from './cacheUtils';

// import {
//   printAST,
// } from './debug';

export function runQuery({ store, query }) {
  const queryDef = parseQueryIfString(query);

  return runSelectionSet({
    store,
    rootId: 'ROOT_QUERY',
    selectionSet: queryDef.selectionSet,
  });
}

export function runFragment({ store, fragment, rootId }) {
  const fragmentDef = parseFragmentIfString(fragment);

  return runSelectionSet({
    store,
    rootId,
    selectionSet: fragmentDef.selectionSet,
  });
}

function runSelectionSet({ store, rootId, selectionSet }) {
  if (selectionSet.kind !== 'SelectionSet') {
    throw new Error('Must be a selection set.');
  }

  const result = {};
  const cacheObj = store[rootId];

  selectionSet.selections.forEach((selection) => {
    const cacheFieldName = cacheFieldNameFromSelection(selection);
    const resultFieldName = resultFieldNameFromSelection(selection);

    if (! has(cacheObj, cacheFieldName)) {
      throw new Error(`Can't find field ${cacheFieldName} on object ${cacheObj}.`);
    }

    if (! selection.selectionSet) {
      result[resultFieldName] = cacheObj[cacheFieldName];
      return;
    }

    if (isArray(cacheObj[cacheFieldName])) {
      result[resultFieldName] = cacheObj[cacheFieldName].map((id) => {
        return runSelectionSet({
          store,
          rootId: id,
          selectionSet: selection.selectionSet,
        });
      });
      return;
    }

    // This is a nested query
    result[resultFieldName] = runSelectionSet({
      store,
      rootId: cacheObj[cacheFieldName],
      selectionSet: selection.selectionSet,
    });
  });

  return result;
}
