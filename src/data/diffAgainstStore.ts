import isArray = require('lodash.isarray');
import isNull = require('lodash.isnull');
import isObject = require('lodash.isobject');
import has = require('lodash.has');
import merge = require('lodash.merge');

import {
  storeKeyNameFromField,
  resultKeyNameFromField,
  isField,
  isInlineFragment,
} from './storeUtils';

import {
  NormalizedCache,
  isJsonValue,
  isIdValue,
} from './store';

import {
  SelectionSetWithRoot,
} from '../queries/store';

import {
  SelectionSet,
  Field,
  Directive,
  Document,
  Selection,
  FragmentDefinition,
  OperationDefinition,
  Variable,
} from 'graphql';

import {
  getQueryDefinition,
  getFragmentDefinition,
  FragmentMap,
} from '../queries/getFromAST';

import {
  shouldInclude,
} from '../queries/directives';

import {
  ApolloError,
} from '../errors';

import flatten = require('lodash.flatten');

export interface DiffResult {
  result: any;
  isMissing?: 'true';
  missingSelectionSets?: SelectionSetWithRoot[];
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
  store: NormalizedCache,
  fragment: Document,
  rootId: string,
  variables?: Object,
}): DiffResult {
  const fragmentDef = getFragmentDefinition(fragment);

  return diffSelectionSetAgainstStore({
    store,
    rootId,
    selectionSet: fragmentDef.selectionSet,
    throwOnMissingField: false,
    variables,
  });
}

// Takes a map of errors for fragments of each type. If all of the types have
// thrown an error, this function will throw the error associated with one
// of the types.
export function handleFragmentErrors(fragmentErrors: { [typename: string]: Error }) {
  const typenames = Object.keys(fragmentErrors);

  // This is a no-op.
  if (typenames.length === 0) {
    return;
  }

  const errorTypes = typenames.filter((typename) => {
    return (fragmentErrors[typename] !== null);
  });

  if (errorTypes.length === Object.keys(fragmentErrors).length) {
    throw fragmentErrors[errorTypes[0]];
  }
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
}: {
  selectionSet: SelectionSet,
  store: NormalizedCache,
  rootId: string,
  throwOnMissingField: boolean,
  variables: Object,
  fragmentMap?: FragmentMap,
}): DiffResult {
  if (selectionSet.kind !== 'SelectionSet') {
    throw new Error('Must be a selection set.');
  }

  if (!fragmentMap) {
    fragmentMap = {};
  }

  const result = {};
  const missingFields: Selection[] = [];

  // A map going from a typename to missing field errors thrown on that
  // typename. This data structure is needed to support union types. For example, if we have
  // a union type (Apple | Orange) and we only receive fields for fragments on
  // "Apple", that should not result in an error. But, if at least one of the fragments
  // for each of "Apple" and "Orange" is missing a field, that should return an error.
  // (i.e. with this approach, we manage to handle missing fields correctly even for
  // union types without any knowledge of the GraphQL schema).
  let fragmentErrors: { [typename: string]: Error } = {};

  selectionSet.selections.forEach((selection) => {
    // Don't push more than one missing field per field in the query
    let missingFieldPushed = false;
    let fieldResult: any;
    let fieldIsMissing: string;

    function pushMissingField(missingField: Selection) {
      if (!missingFieldPushed) {
        missingFields.push(missingField);
        missingFieldPushed = true;
      }
    }

    const included = shouldInclude(selection, variables);

    if (isField(selection)) {
      const diffResult = diffFieldAgainstStore({
        field: selection,
        throwOnMissingField,
        variables,
        rootId,
        store,
        fragmentMap,
        included,
      });
      fieldIsMissing = diffResult.isMissing;
      fieldResult = diffResult.result;

      const resultFieldKey = resultKeyNameFromField(selection);
      if (fieldIsMissing) {
        // even if the field is not included, we want to keep it in the
        // query that is sent to the server. So, we push it into the set of
        // fields that is missing.
        pushMissingField(selection);
      }
      if (included && fieldResult !== undefined) {
        (result as any)[resultFieldKey] = fieldResult;
      }
    } else if (isInlineFragment(selection)) {
      const typename = selection.typeCondition.name.value;

      if (included) {
        try {
          const diffResult = diffSelectionSetAgainstStore({
            selectionSet: selection.selectionSet,
            throwOnMissingField,
            variables,
            rootId,
            store,
            fragmentMap,
          });
          fieldIsMissing = diffResult.isMissing;
          fieldResult = diffResult.result;

          if (fieldIsMissing) {
            pushMissingField(selection);
          }

          if (isObject(fieldResult)) {
            merge(result, fieldResult);
          }
          if (!fragmentErrors[typename]) {
            fragmentErrors[typename] = null;
          }
        } catch (e) {
          if (e.extraInfo && e.extraInfo.isFieldError) {
            fragmentErrors[typename] = e;
          } else {
            throw e;
          }
        }
      }
    } else {
      const fragment = fragmentMap[selection.name.value];

      if (!fragment) {
        throw new Error(`No fragment named ${selection.name.value}`);
      }

      const typename = fragment.typeCondition.name.value;

      if (included) {
        try {
          const diffResult = diffSelectionSetAgainstStore({
            selectionSet: fragment.selectionSet,
            throwOnMissingField,
            variables,
            rootId,
            store,
            fragmentMap,
          });
          fieldIsMissing = diffResult.isMissing;
          fieldResult = diffResult.result;

          if (fieldIsMissing) {
            pushMissingField(selection);
          }
          if (isObject(fieldResult)) {
            merge(result, fieldResult);
          }

          if (!fragmentErrors[typename]) {
            fragmentErrors[typename] = null;
          }
        } catch (e) {
          if (e.extraInfo && e.extraInfo.isFieldError) {
            fragmentErrors[typename] = e;
          } else {
            throw e;
          }
        }
      }
    }
  });

  if (throwOnMissingField) {
    handleFragmentErrors(fragmentErrors);
  }

  // Set this to true if we don't have enough information at this level to generate a refetch
  // query, so we need to merge the selection set with the parent, rather than appending
  let isMissing: any;
  let missingSelectionSets: any;

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

function diffFieldAgainstStore({
  field,
  throwOnMissingField,
  variables,
  rootId,
  store,
  fragmentMap,
  included = true,
}: {
  field: Field,
  throwOnMissingField: boolean,
  variables: Object,
  rootId: string,
  store: NormalizedCache,
  fragmentMap?: FragmentMap,
  included?: Boolean,
}): FieldDiffResult {
  const storeObj = store[rootId] || {};
  const storeFieldKey = storeKeyNameFromField(field, variables);

  if (! has(storeObj, storeFieldKey)) {
    if (throwOnMissingField && included) {
      throw new ApolloError({
        errorMessage: `Can't find field ${storeFieldKey} on object (${rootId}) ${JSON.stringify(storeObj, null, 2)}.
Perhaps you want to use the \`returnPartialData\` option?`,
        extraInfo: {
          isFieldError: true,
        },
      });
    }

    return {
      isMissing: 'true',
    };
  }

  const storeValue = storeObj[storeFieldKey];

  // Handle all scalar types here
  if (! field.selectionSet) {
    if (isJsonValue(storeValue)) {
      // if this is an object scalar, it must be a json blob and we have to unescape it
      return {
        result: storeValue.json,
      };
    } else {
      // if this is a non-object scalar, we can return it immediately
      return {
        result: storeValue,
      };
    }
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
    let isMissing: any;

    const result = (storeValue as string[]).map((id) => {
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

  // If the store value is an object and it has a selection set, it must be
  // an escaped id.
  if (isIdValue(storeValue)) {
    const unescapedId = storeValue.id;
    return diffSelectionSetAgainstStore({
      store,
      throwOnMissingField,
      rootId: unescapedId,
      selectionSet: field.selectionSet,
      variables,
      fragmentMap,
    });
  }

  throw new Error('Unexpected value in the store where the query had a subselection.');
}

interface FieldDiffResult {
  result?: any;
  isMissing?: 'true';
}

function collectUsedVariablesFromSelectionSet(selectionSet: SelectionSet): any[] {
  return uniq(flatten(selectionSet.selections.map((selection) => {
    if (isField(selection)) {
      return collectUsedVariablesFromField(selection);
    } else if (isInlineFragment(selection)) {
      return collectUsedVariablesFromSelectionSet(selection.selectionSet);
    } else {
      // Some named fragment. Don't handle it here, rely on the caller
      // to process fragments separately.
      return [];
    }
  })));
}

function collectUsedVariablesFromDirectives(directives: Directive[]) {
  return flatten(directives.map(directive => {
    if (directive.arguments) {
      return flatten(directive.arguments.map(arg => {
        if (arg.kind === 'Argument' && arg.value.kind === 'Variable') {
          return [(arg.value as Variable).name.value];
        }

        return [];
      }));
    }

    return [];
  }));
}

function collectUsedVariablesFromField(field: Field) {
  let variables: any[] = [];

  if (field.arguments) {
    variables = flatten(field.arguments.map((arg) => {
      if (arg.value.kind === 'Variable') {
        return [(arg.value as Variable).name.value];
      }

      return [];
    }));
  }

  if (field.selectionSet) {
    variables = [
        ...variables,
        ...collectUsedVariablesFromSelectionSet(field.selectionSet),
    ];
  }

  if (field.directives) {
    variables = [
      ...variables,
      ...collectUsedVariablesFromDirectives(field.directives),
    ];
  }

  return uniq(variables);
}

export function removeUnusedVariablesFromQuery (
  query: Document
): void {
  const queryDef = getQueryDefinition(query);
  const usedVariables = flatten(
    query.definitions.map((def) => collectUsedVariablesFromSelectionSet(
      (def as FragmentDefinition | OperationDefinition).selectionSet)));

  if (!queryDef.variableDefinitions) {
    return;
  }

  const diffedVariableDefinitions =
    queryDef.variableDefinitions.filter((variableDefinition) => {
      return usedVariables.indexOf(
        variableDefinition.variable.name.value) !== -1;
    });

  queryDef.variableDefinitions = diffedVariableDefinitions;
}

function uniq(array: any[]): any[] {
  return array.filter(
    (item, index, arr) =>
      arr.indexOf(item) === index);
}
