import {
  storeKeyNameFromFieldNameAndArgs,
} from './storeUtils';

import {
  NormalizedCache,
  isJsonValue,
  isIdValue,
} from './store';

import {
  SelectionSet,
  Document,
  OperationDefinition,
  FragmentDefinition,
} from 'graphql';

import {
  getQueryDefinition,
  getFragmentDefinition,
  FragmentMap,
} from '../queries/getFromAST';

import {
  ApolloError,
} from '../errors/ApolloError';

import graphql, {
  Resolver,
  ResultMapper,
} from 'graphql-anywhere';

export interface DiffResult {
  result?: any;
  isMissing?: boolean;
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

type ReadStoreContext = {
  store: NormalizedCache;
  throwOnMissingField: boolean;
}

const readStoreResolver: Resolver = (
  fieldName: string,
  objId: string,
  args: any,
  context: ReadStoreContext
) => {
  const obj = context.store[objId];
  const storeKeyName = storeKeyNameFromFieldNameAndArgs(fieldName, args);
  const fieldValue = obj[storeKeyName];

  if (typeof fieldValue === 'undefined') {
    if (context.throwOnMissingField) {
      throw new ApolloError({
        errorMessage: `Can't find field ${storeKeyName} on object (${objId}) ${JSON.stringify(obj, null, 2)}.
Perhaps you want to use the \`returnPartialData\` option?`,
        extraInfo: {
          isFieldError: true,
        },
      });
    }

    return fieldValue;
  }

  if (isJsonValue(fieldValue)) {
    // if this is an object scalar, it must be a json blob and we have to unescape it
    return fieldValue.json;
  }

  if (isIdValue(fieldValue)) {
    return fieldValue.id;
  }

  return fieldValue;
};

const mapper: ResultMapper = (childValues, rootValue) => childValues;

/**
 * Given a store, a root ID, and a selection set, return as much of the result as possible and
 * identify which selection sets and root IDs need to be fetched to get the rest of the requested
 * data.
 * @param  {SelectionSet} selectionSet A GraphQL selection set
 * @param  {Store} store The Apollo Client store object
 * @param  {String} rootId The ID of the root object that the selection set applies to
 * @param  {boolean} [throwOnMissingField] Throw an error rather than returning any selection sets
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
  const doc = makeDocument(selectionSet, rootId, fragmentMap);

  const context: ReadStoreContext = {
    store,
    throwOnMissingField,
  };

  const result = graphql(readStoreResolver, doc, 'ROOT_QUERY', context, variables, mapper);

  return { result };
}

// Shim to use graphql-anywhere, to be removed
function makeDocument(
  selectionSet: SelectionSet,
  rootId: string,
  fragmentMap: FragmentMap
): Document {
  if (rootId !== 'ROOT_QUERY') {
    throw new Error('only supports query');
  }

  const op: OperationDefinition = {
    kind: 'OperationDefinition',
    operation: 'query',
    selectionSet,
  };

  const frags: FragmentDefinition[] = fragmentMap ?
    Object.keys(fragmentMap).map((name) => fragmentMap[name]) :
    [];

  const doc: Document = {
    kind: 'Document',
    definitions: [op, ...frags],
  };

  return doc;
}
