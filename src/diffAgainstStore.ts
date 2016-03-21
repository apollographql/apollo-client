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
  SelectionSet,
  Field,
} from 'graphql';

export function diffQueryAgainstStore({ store, query }: {
  store: Object,
  query: Document | string
}) {
  const queryDef = parseQueryIfString(query);

  return diffSelectionSetAgainstStore({
    store,
    rootId: 'ROOT_QUERY',
    selectionSet: queryDef.selectionSet,
    throwOnMissingField: false,
  });
}

export function diffFragmentAgainstStore({ store, fragment, rootId }) {
  const fragmentDef = parseFragmentIfString(fragment);

  return diffSelectionSetAgainstStore({
    store,
    rootId,
    selectionSet: fragmentDef.selectionSet,
    throwOnMissingField: false,
  });
}

/**
 * Given a store, a root ID, and a selection set, return as much of the result as possible and
 * identify which selection sets and root IDs need to be fetched to get the rest of the requested
 * data.
 * @param  {SelectionSet} selectionSet A GraphQL selection set
 * @param  {Store} store The Apollo Client store object
 * @param  {String} rootId The ID of the root object that the selection set applies to
 * @param  {Boolean} [throwOnMissingField] Throw an error rather than returning any selection sets
 * when a field isn't found in the store.
 * @return {result: Object, missingSelectionSets: [SelectionSet]}
 */
export function diffSelectionSetAgainstStore({
  selectionSet,
  store,
  rootId,
  throwOnMissingField = false,
}: {
  selectionSet: SelectionSet,
  store: Object,
  rootId: string,
  throwOnMissingField: Boolean,
}) {
  if (selectionSet.kind !== 'SelectionSet') {
    throw new Error('Must be a selection set.');
  }

  const result = {};

  const missingSelectionSets: {
    selectionSet: SelectionSet,
    typeName: string,
    id: string,
  }[] = [];

  const missingSelections: Field[] = [];

  const cacheObj = store[rootId];

  selectionSet.selections.forEach((selection) => {
    if (selection.kind !== 'Field') {
       throw new Error('Only fields supported so far, not fragments.');
    }

    const field = selection as Field;

    const cacheFieldName = cacheFieldNameFromField(field);
    const resultFieldName = resultFieldNameFromField(field);

    if (! has(cacheObj, cacheFieldName)) {
      if (throwOnMissingField) {
        throw new Error(`Can't find field ${cacheFieldName} on object ${cacheObj}.`);
      }

      missingSelections.push(field);

      return;
    }

    if (! field.selectionSet) {
      result[resultFieldName] = cacheObj[cacheFieldName];
      return;
    }

    if (isArray(cacheObj[cacheFieldName])) {
      result[resultFieldName] = cacheObj[cacheFieldName].map((id) => {
        const itemDiffResult = diffSelectionSetAgainstStore({
          store,
          throwOnMissingField,
          rootId: id,
          selectionSet: field.selectionSet,
        });

        itemDiffResult.missingSelectionSets.forEach(
          itemSelectionSet => missingSelectionSets.push(itemSelectionSet));
        return itemDiffResult.result;
      });
      return;
    }

    const subObjDiffResult = diffSelectionSetAgainstStore({
      store,
      throwOnMissingField,
      rootId: cacheObj[cacheFieldName],
      selectionSet: field.selectionSet,
    });

    // This is a nested query
    subObjDiffResult.missingSelectionSets.forEach(
      subObjSelectionSet => missingSelectionSets.push(subObjSelectionSet));

    result[resultFieldName] = subObjDiffResult.result;
  });

  // If we weren't able to resolve some selections from the cache, construct them into
  // a query we can fetch from the server
  if (missingSelections.length) {
    if (! cacheObj.__typename) {
      throw new Error(
        `Can't generate query to refetch object ${rootId}, since __typename wasn't in the cache.`);
    }

    missingSelectionSets.push({
      id: rootId,
      typeName: cacheObj.__typename,
      selectionSet: {
        kind: 'SelectionSet',
        selections: missingSelections,
      },
    });
  }

  return {
    result,
    missingSelectionSets,
  };
}
