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

export function diffQueryAgainstStore({ store, query }) {
  const queryDef = parseQueryIfString(query);

  return diffSelectionSetAgainstStore({
    store,
    rootId: 'ROOT_QUERY',
    selectionSet: queryDef.selectionSet,
  });
}

export function diffFragmentAgainstStore({ store, fragment, rootId }) {
  const fragmentDef = parseFragmentIfString(fragment);

  return diffSelectionSetAgainstStore({
    store,
    rootId,
    selectionSet: fragmentDef.selectionSet,
  });
}

export function diffSelectionSetAgainstStore({
  selectionSet,
  store,
  rootId,
  throwOnMissingField = false,
}) {
  if (selectionSet.kind !== 'SelectionSet') {
    throw new Error('Must be a selection set.');
  }

  const result = {};
  const missingFields = [];

  const cacheObj = store[rootId];

  selectionSet.selections.forEach((selection) => {
    const cacheFieldName = cacheFieldNameFromSelection(selection);
    const resultFieldName = resultFieldNameFromSelection(selection);

    if (! has(cacheObj, cacheFieldName)) {
      if (throwOnMissingField) {
        throw new Error(`Can't find field ${cacheFieldName} on object ${cacheObj}.`);
      }

      missingFields.push({
        id: rootId,
        field: cacheFieldName,
      });
      return;
    }

    if (! selection.selectionSet) {
      result[resultFieldName] = cacheObj[cacheFieldName];
      return;
    }

    if (isArray(cacheObj[cacheFieldName])) {
      result[resultFieldName] = cacheObj[cacheFieldName].map((id) => {
        const itemDiffResult = diffSelectionSetAgainstStore({
          store,
          throwOnMissingField,
          rootId: id,
          selectionSet: selection.selectionSet,
        });

        itemDiffResult.missingFields.forEach(field => missingFields.push(field));
        return itemDiffResult.result;
      });
      return;
    }

    const subObjDiffResult = diffSelectionSetAgainstStore({
      store,
      throwOnMissingField,
      rootId: cacheObj[cacheFieldName],
      selectionSet: selection.selectionSet,
    });

    // This is a nested query
    subObjDiffResult.missingFields.forEach(field => missingFields.push(field));
    result[resultFieldName] = subObjDiffResult.result;
  });

  return {
    result,
    missingFields,
  };
}
