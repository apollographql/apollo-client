import {
  isArray,
  isNull,
  isString,
  has,
} from 'lodash';

import {
  parseFragment,
  parseQuery,
} from './parser';

import {
  storeKeyNameFromField,
  resultKeyNameFromField,
} from './storeUtils';

import {
  Store,
} from './store';

import {
  SelectionSet,
  Field,
} from 'graphql';

export interface QueryDiffResult {
  result: any;
  missingSelectionSets: MissingSelectionSet[];
}

export interface MissingSelectionSet {
  id: string;
  typeName: string;
  selectionSet: SelectionSet;
}

export function diffQueryAgainstStore({
  store,
  query,
  variables,
}: {
  store: Store,
  query: string
  variables?: Object,
}): QueryDiffResult {
  const queryDef = parseQuery(query);

  return diffSelectionSetAgainstStore({
    store,
    rootId: 'ROOT_QUERY',
    selectionSet: queryDef.selectionSet,
    throwOnMissingField: false,
    variables,
  });
}

export function diffFragmentAgainstStore({
  store,
  fragment,
  rootId,
  variables,
}: {
  store: Store,
  fragment: string,
  rootId: string,
  variables?: Object,
}): QueryDiffResult {
  const fragmentDef = parseFragment(fragment);

  return diffSelectionSetAgainstStore({
    store,
    rootId,
    selectionSet: fragmentDef.selectionSet,
    throwOnMissingField: false,
    variables,
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
  variables,
}: {
  selectionSet: SelectionSet,
  store: Store,
  rootId: string,
  throwOnMissingField: Boolean,
  variables: Object,
}): QueryDiffResult {
  if (selectionSet.kind !== 'SelectionSet') {
    throw new Error('Must be a selection set.');
  }

  const result = {};

  const missingSelectionSets: MissingSelectionSet[] = [];

  const missingSelections: Field[] = [];

  const storeObj = store[rootId] || {};

  selectionSet.selections.forEach((selection) => {
    if (selection.kind !== 'Field') {
       throw new Error('Only fields supported so far, not fragments.');
    }

    const field = selection as Field;

    const storeFieldKey = storeKeyNameFromField(field, variables);
    const resultFieldKey = resultKeyNameFromField(field);

    if (! has(storeObj, storeFieldKey)) {
      if (throwOnMissingField) {
        throw new Error(`Can't find field ${storeFieldKey} on object ${storeObj}.`);
      }

      missingSelections.push(field);

      return;
    }

    const storeValue = storeObj[storeFieldKey];

    if (! field.selectionSet) {
      result[resultFieldKey] = storeValue;
      return;
    }

    if (isNull(storeValue)) {
      // Basically any field in a GraphQL response can be null
      result[resultFieldKey] = null;
      return;
    }

    if (isArray(storeValue)) {
      result[resultFieldKey] = storeValue.map((id) => {
        // null value in array
        if (isNull(id)) {
          return null;
        }

        const itemDiffResult = diffSelectionSetAgainstStore({
          store,
          throwOnMissingField,
          rootId: id,
          selectionSet: field.selectionSet,
          variables,
        });

        itemDiffResult.missingSelectionSets.forEach(
          itemSelectionSet => missingSelectionSets.push(itemSelectionSet));
        return itemDiffResult.result;
      });
      return;
    }

    if (isString(storeValue)) {
      const subObjDiffResult = diffSelectionSetAgainstStore({
        store,
        throwOnMissingField,
        rootId: storeValue,
        selectionSet: field.selectionSet,
        variables,
      });

      // This is a nested query
      subObjDiffResult.missingSelectionSets.forEach(
        subObjSelectionSet => missingSelectionSets.push(subObjSelectionSet));

      result[resultFieldKey] = subObjDiffResult.result;
      return;
    }

    throw new Error('Unexpected number value in the store where the query had a subselection.');
  });

  // If we weren't able to resolve some selections from the store, construct them into
  // a query we can fetch from the server
  if (missingSelections.length) {
    const id = storeObj['id'];
    if (typeof id !== 'string' && rootId !== 'ROOT_QUERY') {
      throw new Error(
        `Can't generate query to refetch object ${rootId}, since it doesn't have a string id.`);
    }

    let typeName: string;

    if (rootId === 'ROOT_QUERY') {
      // We don't need to do anything interesting to fetch root queries, like have an ID
      typeName = 'Query';
    } else if (! storeObj.__typename) {
      throw new Error(
        `Can't generate query to refetch object ${rootId}, since __typename wasn't in the store.`);
    } else {
      typeName = storeObj.__typename;
    }

    missingSelectionSets.push({
      id: rootId,
      typeName,
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
