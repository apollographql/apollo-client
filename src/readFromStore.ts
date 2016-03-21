/// <reference path="../typings/browser/ambient/es6-promise/index.d.ts" />
/// <reference path="../typings/browser/ambient/graphql/index.d.ts" />
/// <reference path="../typings/browser/definitions/lodash/index.d.ts" />

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

import {
  Document,
  OperationDefinition,
  SelectionSet,
} from 'graphql';

// import {
//   printAST,
// } from './debug';

export function readQueryFromStore({ store, query }: { store: Object, query: Document | string }): Object {
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
    rootId
}: { store: Object, fragment: Document | string, rootId: string }): Object {
  const fragmentDef: OperationDefinition = parseFragmentIfString(fragment);

  return readSelectionSetFromStore({
    store,
    rootId,
    selectionSet: fragmentDef.selectionSet,
  });
}

function readSelectionSetFromStore({
    store,
    rootId,
    selectionSet
}: {store: Object, rootId: string, selectionSet: SelectionSet }): Object {
  if (selectionSet.kind !== 'SelectionSet') {
    throw new Error('Must be a selection set.');
  }

  const result: Object = {};
  const cacheObj: Object = store[rootId];

  selectionSet.selections.forEach((selection) => {
    const cacheFieldName: string = cacheFieldNameFromSelection(selection);
    const resultFieldName: string = resultFieldNameFromSelection(selection);

    if (! has(cacheObj, cacheFieldName)) {
      throw new Error(`Can't find field ${cacheFieldName} on object ${cacheObj}.`);
    }

    if (! selection.selectionSet) {
      result[resultFieldName] = cacheObj[cacheFieldName];
      return;
    }

    if (isArray(cacheObj[cacheFieldName])) {
      result[resultFieldName] = cacheObj[cacheFieldName].map((id) => {
        return readSelectionSetFromStore({
          store,
          rootId: id,
          selectionSet: selection.selectionSet,
        });
      });
      return;
    }

    // This is a nested query
    result[resultFieldName] = readSelectionSetFromStore({
      store,
      rootId: cacheObj[cacheFieldName],
      selectionSet: selection.selectionSet,
    });
  });

  return result;
}
