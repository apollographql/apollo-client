import isArray = require('lodash.isarray');
import isNull = require('lodash.isnull');
import isString = require('lodash.isstring');
import has = require('lodash.has');
import assign = require('lodash.assign');

import {
  storeKeyNameFromField,
  resultKeyNameFromField,
  isField,
  isInlineFragment,
} from './storeUtils';

import {
  NormalizedCache,
} from './store';

import {
  SelectionSetWithRoot,
} from '../queries/store';

import {
  SelectionSet,
  Field,
  Document,
  Selection,
} from 'graphql';

import {
  getQueryDefinition,
  getFragmentDefinition,
  FragmentMap,
} from '../queries/getFromAST';

import {
  shouldInclude,
} from '../queries/directives';

export interface DiffResult {
  result: any;
  isMissing?: 'true';
  missingSelectionSets?: SelectionSetWithRoot[];
}

export function diffQueryAgainstStore({
  store,
  query,
  variables,
  quietFields,
}: {
  store: NormalizedCache,
  query: Document,
  variables?: Object,
  quietFields?: string[],
}): DiffResult {
  const queryDef = getQueryDefinition(query);

  return diffSelectionSetAgainstStore({
    store,
    rootId: 'ROOT_QUERY',
    selectionSet: queryDef.selectionSet,
    throwOnMissingField: false,
    variables,
    quietFields,
  });
}

export function diffFragmentAgainstStore({
  store,
  fragment,
  rootId,
  variables,
  quietFields,
}: {
  store: NormalizedCache,
  fragment: Document,
  rootId: string,
  variables?: Object,
  quietFields?: string[],
}): DiffResult {
  const fragmentDef = getFragmentDefinition(fragment);

  return diffSelectionSetAgainstStore({
    store,
    rootId,
    selectionSet: fragmentDef.selectionSet,
    throwOnMissingField: false,
    variables,
    quietFields,
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
  fragmentMap,
  quietFields,
}: {
  selectionSet: SelectionSet,
  store: NormalizedCache,
  rootId: string,
  throwOnMissingField: boolean,
  variables: Object,
  fragmentMap?: FragmentMap,
  quietFields?: string[],
}): DiffResult {
  if (selectionSet.kind !== 'SelectionSet') {
    throw new Error('Must be a selection set.');
  }

  if (!fragmentMap) {
    fragmentMap = {};
  }

  const result = {};
  const missingFields: Selection[] = [];

  selectionSet.selections.forEach((selection) => {
    // Don't push more than one missing field per field in the query
    let missingFieldPushed = false;

    function pushMissingField(missingField: Selection) {
      if (!missingFieldPushed) {
        missingFields.push(missingField);
        missingFieldPushed = true;
      }
    }

    if (isField(selection)) {
        const includeField = shouldInclude(selection, variables);
        const {
          result: fieldResult,
          isMissing: fieldIsMissing,
        } = diffFieldAgainstStore({
          field: selection,
          throwOnMissingField,
          variables,
          rootId,
          store,
          fragmentMap,
          included: includeField,
          quietFields,
        });

      if (fieldIsMissing) {
        // even if the field is not included, we want to keep it in the
        // query that is sent to the server. So, we push it into the set of
        // fields that is missing.
        pushMissingField(selection);
      } else if (includeField) {
        const resultFieldKey = resultKeyNameFromField(selection);

        result[resultFieldKey] = fieldResult;
      }
    } else if (isInlineFragment(selection)) {
      const {
        result: fieldResult,
        isMissing: fieldIsMissing,
      } = diffSelectionSetAgainstStore({
        selectionSet: selection.selectionSet,
        throwOnMissingField,
        variables,
        rootId,
        store,
        fragmentMap,
        quietFields,
      });

      if (fieldIsMissing) {
        pushMissingField(selection);
      } else {
        assign(result, fieldResult);
      }
    } else {
      const fragment = fragmentMap[selection.name.value];
      if (!fragment) {
        throw new Error(`No fragment named ${selection.name.value}`);
      }

      const {
        result: fieldResult,
        isMissing: fieldIsMissing,
      } = diffSelectionSetAgainstStore({
        selectionSet: fragment.selectionSet,
        throwOnMissingField,
        variables,
        rootId,
        store,
        fragmentMap,
        quietFields,
      });

      if (fieldIsMissing) {
        pushMissingField(selection);
      } else {
        assign(result, fieldResult);
      }
    }
  });

  // Set this to true if we don't have enough information at this level to generate a refetch
  // query, so we need to merge the selection set with the parent, rather than appending
  let isMissing;
  let missingSelectionSets;

  // If we weren't able to resolve some selections from the store, construct them into
  // a query we can fetch from the server
  if (missingFields.length) {
    if (rootId === 'ROOT_QUERY') {
      const typeName = 'Query';

      missingSelectionSets = [
        {
          id: rootId,
          typeName,
          selectionSet: {
            kind: 'SelectionSet',
            selections: missingFields,
          },
        },
      ];
    } else {
      isMissing = 'true';
    }
  }

  return {
    result,
    isMissing,
    missingSelectionSets,
  };
}

export function diffFieldAgainstStore({
  field,
  throwOnMissingField,
  variables,
  rootId,
  store,
  fragmentMap,
  included = true,
  quietFields,
}: {
  field: Field,
  throwOnMissingField: boolean,
  variables: Object,
  rootId: string,
  store: NormalizedCache,
  fragmentMap?: FragmentMap,
  included?: Boolean,
  quietFields?: string[],
}): FieldDiffResult {
  const storeObj = store[rootId] || {};
  const storeFieldKey = storeKeyNameFromField(field, variables, quietFields);

  if (! has(storeObj, storeFieldKey)) {
    if (throwOnMissingField && included) {
      throw new Error(`Can't find field ${storeFieldKey} on object ${storeObj}.`);
    }

    return {
      isMissing: 'true',
    };
  }

  const storeValue = storeObj[storeFieldKey];

  // Handle all scalar types here
  if (! field.selectionSet) {
    return {
      result: storeValue,
    };
  }

  // From here down, the field has a selection set, which means it's trying to
  // query a GraphQLObjectType
  if (isNull(storeValue)) {
    // Basically any field in a GraphQL response can be null
    return {
      result: null,
    };
  }

  if (isArray(storeValue)) {
    let isMissing;

    const result = storeValue.map((id) => {
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
        fragmentMap,
        quietFields,
      });

      if (itemDiffResult.isMissing) {
        // XXX merge all of the missing selections from the children to get a more minimal result
        isMissing = 'true';
      }

      return itemDiffResult.result;
    });

    return {
      result,
      isMissing,
    };
  }

  if (isString(storeValue)) {
    return diffSelectionSetAgainstStore({
      store,
      throwOnMissingField,
      rootId: storeValue,
      selectionSet: field.selectionSet,
      variables,
      fragmentMap,
      quietFields,
    });
  }

  throw new Error('Unexpected number value in the store where the query had a subselection.');
}

export interface FieldDiffResult {
  result?: any;
  isMissing?: 'true';
}
