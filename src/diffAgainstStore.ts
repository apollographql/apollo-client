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

export function diffQueryAgainstStore({ store, query }: {
  store: Store,
  query: string
}) {
  const queryDef = parseQuery(query);

  return diffSelectionSetAgainstStore({
    store,
    rootId: 'ROOT_QUERY',
    selectionSet: queryDef.selectionSet,
    throwOnMissingField: false,
  });
}

export function diffFragmentAgainstStore({ store, fragment, rootId }: {
  store: Store,
  fragment: string,
  rootId: string,
}) {
  const fragmentDef = parseFragment(fragment);

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
  store: Store,
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

  const storeObj = store[rootId];

  selectionSet.selections.forEach((selection) => {
    if (selection.kind !== 'Field') {
       throw new Error('Only fields supported so far, not fragments.');
    }

    const field = selection as Field;

    const storeFieldKey = storeKeyNameFromField(field);
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

    if (isString(storeValue)) {
      const subObjDiffResult = diffSelectionSetAgainstStore({
        store,
        throwOnMissingField,
        rootId: storeValue,
        selectionSet: field.selectionSet,
      });

      // This is a nested query
      subObjDiffResult.missingSelectionSets.forEach(
        subObjSelectionSet => missingSelectionSets.push(subObjSelectionSet));

      result[resultFieldKey] = subObjDiffResult.result;
    }
  });

  // If we weren't able to resolve some selections from the store, construct them into
  // a query we can fetch from the server
  if (missingSelections.length) {
    if (! storeObj.__typename) {
      throw new Error(
        `Can't generate query to refetch object ${rootId}, since __typename wasn't in the store.`);
    }

    missingSelectionSets.push({
      id: rootId,
      typeName: storeObj.__typename,
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
