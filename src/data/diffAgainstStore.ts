import {
  isArray,
  isNull,
  isString,
  has,
} from 'lodash';

import {
  parseFragment,
  parseQuery,
} from '../parser';

import {
  storeKeyNameFromField,
  resultKeyNameFromField,
} from './storeUtils';

import {
  NormalizedCache,
} from './store';

import {
  SelectionSetWithRoot,
} from '../queries/store';

import {
  IdGetter,
} from './extensions';

import {
  SelectionSet,
  Field,
} from 'graphql';

export interface QueryDiffResult {
  result: any;
  missingSelectionSets: SelectionSetWithRoot[];
  mergeUp: boolean;
}

export function diffQueryAgainstStore({
  store,
  query,
  variables,
  dataIdFromObject,
}: {
  store: NormalizedCache,
  query: string
  variables?: Object,
  dataIdFromObject?: IdGetter,
}): QueryDiffResult {
  const queryDef = parseQuery(query);

  return diffSelectionSetAgainstStore({
    store,
    rootId: 'ROOT_QUERY',
    selectionSet: queryDef.selectionSet,
    throwOnMissingField: false,
    variables,
    dataIdFromObject,
  });
}

export function diffFragmentAgainstStore({
  store,
  fragment,
  rootId,
  variables,
  dataIdFromObject,
}: {
  store: NormalizedCache,
  fragment: string,
  rootId: string,
  variables?: Object,
  dataIdFromObject?: IdGetter,
}): QueryDiffResult {
  const fragmentDef = parseFragment(fragment);

  return diffSelectionSetAgainstStore({
    store,
    rootId,
    selectionSet: fragmentDef.selectionSet,
    throwOnMissingField: false,
    variables,
    dataIdFromObject,
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
  dataIdFromObject,
}: {
  selectionSet: SelectionSet,
  store: NormalizedCache,
  rootId: string,
  throwOnMissingField: Boolean,
  variables: Object,
  dataIdFromObject?: IdGetter,
}): QueryDiffResult {
  if (selectionSet.kind !== 'SelectionSet') {
    throw new Error('Must be a selection set.');
  }

  const result = {};
  const missingSelectionSets: SelectionSetWithRoot[] = [];
  const missingFields: Field[] = [];
  const storeObj = store[rootId] || {};

  selectionSet.selections.forEach((selection) => {
    if (selection.kind !== 'Field') {
       throw new Error('Only fields supported so far, not fragments.');
    }

    const field = selection as Field;

    const storeFieldKey = storeKeyNameFromField(field, variables);
    const resultFieldKey = resultKeyNameFromField(field);

    // Don't push more than one missing field per field in the query
    let missingFieldPushed = false;
    function pushMissingField(missingField: Field) {
      if (!missingFieldPushed) {
        missingFields.push(missingField);
        missingFieldPushed = true;
      }
    }

    if (! has(storeObj, storeFieldKey)) {
      if (throwOnMissingField) {
        throw new Error(`Can't find field ${storeFieldKey} on object ${storeObj}.`);
      }

      missingFields.push(field);

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
          dataIdFromObject,
        });

        if (! itemDiffResult.mergeUp) {
          itemDiffResult.missingSelectionSets.forEach(
            itemSelectionSet => missingSelectionSets.push(itemSelectionSet));
        } else {
          // XXX merge all of the missing selections from the children to get a more minimal result
          pushMissingField(field);
        }

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
        dataIdFromObject,
      });

      if (! subObjDiffResult.mergeUp) {
        subObjDiffResult.missingSelectionSets.forEach(
          subObjSelectionSet => missingSelectionSets.push(subObjSelectionSet));
      } else {
        // XXX merge all of the missing selections from the children to get a more minimal result
        pushMissingField(field);
      }

      result[resultFieldKey] = subObjDiffResult.result;
      return;
    }

    throw new Error('Unexpected number value in the store where the query had a subselection.');
  });

  // Set this to true if we don't have enough information at this level to generate a refetch
  // query, so we need to merge the selection set with the parent, rather than appending
  let mergeUp = false;

  // If we weren't able to resolve some selections from the store, construct them into
  // a query we can fetch from the server
  if (missingFields.length) {
    if (dataIdFromObject) {
      // We have a semantic understanding of IDs
      const id = dataIdFromObject(storeObj);

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
          selections: missingFields,
        },
      });
    } else if (rootId === 'ROOT_QUERY') {
      const typeName = 'Query';

      missingSelectionSets.push({
        id: rootId,
        typeName,
        selectionSet: {
          kind: 'SelectionSet',
          selections: missingFields,
        },
      });
    } else {
      mergeUp = true;

      missingSelectionSets.push({
        // Sentinel values, all we need is the selection set
        id: 'CANNOT_REFETCH',
        typeName: 'CANNOT_REFETCH',
        selectionSet: {
          kind: 'SelectionSet',
          selections: missingFields,
        },
      });
    }
  }

  return {
    result,
    missingSelectionSets,
    mergeUp,
  };
}
