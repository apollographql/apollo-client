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
  cacheFieldNameFromField,
  resultFieldNameFromField,
} from './cacheUtils';

import {
  Document,
  OperationDefinition,
  FragmentDefinition,
  SelectionSet,
  Field,
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
  const fragmentDef: FragmentDefinition = parseFragmentIfString(fragment);

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
    if (selection.kind !== 'Field') {
       throw new Error('Only fields supported so far, not fragments.');
    }
    
    const field = <Field> selection;
    
    const cacheFieldName: string = cacheFieldNameFromField(field);
    const resultFieldName: string = resultFieldNameFromField(field);

    if (! has(cacheObj, cacheFieldName)) {
      throw new Error(`Can't find field ${cacheFieldName} on object ${cacheObj}.`);
    }

    if (! field.selectionSet) {
      result[resultFieldName] = cacheObj[cacheFieldName];
      return;
    }

    if (isArray(cacheObj[cacheFieldName])) {
      result[resultFieldName] = cacheObj[cacheFieldName].map((id) => {
        return readSelectionSetFromStore({
          store,
          rootId: id,
          selectionSet: field.selectionSet,
        });
      });
      return;
    }

    // This is a nested query
    result[resultFieldName] = readSelectionSetFromStore({
      store,
      rootId: cacheObj[cacheFieldName],
      selectionSet: field.selectionSet,
    });
  });

  return result;
}
