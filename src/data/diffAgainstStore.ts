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

export type ResultTransformer = (result: DiffResult) => DiffResult;

// Contexual state and configuration that is used throught a request from the
// store.
export interface StoreContext {
  store: NormalizedCache;
  fragmentMap: FragmentMap;
  resultTransformer?: ResultTransformer;
}

export function diffQueryAgainstStore({
  store,
  query,
  variables,
}: {
  store: NormalizedCache,
  query: Document,
  variables?: Object,
}): DiffResult {
  const queryDef = getQueryDefinition(query);

  return diffSelectionSetAgainstStore({
    context: { store, fragmentMap: {} },
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
  store: NormalizedCache,
  fragment: Document,
  rootId: string,
  variables?: Object,
}): DiffResult {
  const fragmentDef = getFragmentDefinition(fragment);

  return diffSelectionSetAgainstStore({
    context: { store, fragmentMap: {} },
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
  context,
  selectionSet,
  rootId,
  throwOnMissingField = false,
  variables,
}: {
  context: StoreContext,
  selectionSet: SelectionSet,
  rootId: string,
  throwOnMissingField: boolean,
  variables: Object,
}): DiffResult {
  if (selectionSet.kind !== 'SelectionSet') {
    throw new Error('Must be a selection set.');
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
          context,
          field: selection,
          throwOnMissingField,
          variables,
          rootId,
          included: includeField,
        });

      const resultFieldKey = resultKeyNameFromField(selection);
      if (fieldIsMissing) {
        // even if the field is not included, we want to keep it in the
        // query that is sent to the server. So, we push it into the set of
        // fields that is missing.
        pushMissingField(selection);
      }
      if (includeField && fieldResult !== undefined) {
        result[resultFieldKey] = fieldResult;
      }
    } else if (isInlineFragment(selection)) {
      const {
        result: fieldResult,
        isMissing: fieldIsMissing,
      } = diffSelectionSetAgainstStore({
        context,
        selectionSet: selection.selectionSet,
        throwOnMissingField,
        variables,
        rootId,
      });

      if (fieldIsMissing) {
        pushMissingField(selection);
      } else {
        assign(result, fieldResult);
      }
    } else {
      const fragment = context.fragmentMap[selection.name.value];
      if (!fragment) {
        throw new Error(`No fragment named ${selection.name.value}`);
      }

      const {
        result: fieldResult,
        isMissing: fieldIsMissing,
      } = diffSelectionSetAgainstStore({
        context,
        selectionSet: fragment.selectionSet,
        throwOnMissingField,
        variables,
        rootId,
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

  let diffResult: DiffResult = {
    result,
    isMissing,
    missingSelectionSets,
  };

  if (context.resultTransformer) {
    diffResult = context.resultTransformer(diffResult);
  }

  return diffResult;
}

function diffFieldAgainstStore({
  context,
  field,
  throwOnMissingField,
  variables,
  rootId,
  included = true,
}: {
  context: StoreContext,
  field: Field,
  throwOnMissingField: boolean,
  variables: Object,
  rootId: string,
  included?: Boolean,
}): FieldDiffResult {
  const storeObj = context.store[rootId] || {};
  const storeFieldKey = storeKeyNameFromField(field, variables);

  if (! has(storeObj, storeFieldKey)) {
    if (throwOnMissingField && included) {
      throw new Error(`Can't find field ${storeFieldKey} on object ${JSON.stringify(storeObj)}.
Perhaps you want to use the \`returnPartialData\` option?`);
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
        context,
        throwOnMissingField,
        rootId: id,
        selectionSet: field.selectionSet,
        variables,
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
      context,
      throwOnMissingField,
      rootId: storeValue,
      selectionSet: field.selectionSet,
      variables,
    });
  }

  throw new Error('Unexpected number value in the store where the query had a subselection.');
}

interface FieldDiffResult {
  result?: any;
  isMissing?: 'true';
}
