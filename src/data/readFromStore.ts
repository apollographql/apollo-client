import {
  Document,
} from 'graphql';

import {
  NormalizedCache,
} from './store';

import {
  storeKeyNameFromFieldNameAndArgs,
} from './storeUtils';

import {
  isJsonValue,
  isIdValue,
} from './store';

import {
  FragmentMap,
} from '../queries/getFromAST';

import {
  ApolloError,
} from '../errors/ApolloError';

import graphqlAnywhere, {
  Resolver,
  ResultMapper,
} from 'graphql-anywhere';

// import {
//   printAST,
// } from './debug';

/**
 * Resolves the result of a query solely from the store (i.e. never hits the server).
 *
 * @param store The {@link NormalizedCache} used by Apollo for the `data` portion of the store.
 *
 * @param query The query document to resolve from the data available in the store.
 *
 * @param variables A map from the name of a variable to its value. These variables can be
 * referenced by the query document.
 *
 * @param returnPartialData If set to true, the query will be resolved even if all of the data
 * needed to resolve the query is not found in the store. The data keys that are not found will not
 * be present in the returned object. If set to false, an error will be thrown if there are fields
 * that cannot be resolved from the store.
 *
 * @param fragmentMap A map from the name of a fragment to its fragment definition. These fragments
 * can be referenced within the query document.
 */
export function readQueryFromStore({
  store,
  query,
  variables,
  options = {} as StoreReadOptions,
}: {
  store: NormalizedCache,
  query: Document,
  variables?: Object,
  options?: StoreReadOptions,
}): Object {
  const {
    result,
  } = diffQueryAgainstStore({
    query,
    store,
    options,
    variables,
  });

  return result;
}

export type StoreReadOptions = {
  returnPartialData: boolean;
}

export interface DiffResult {
  result?: any;
  isMissing?: boolean;
}

export function diffQueryAgainstStore({
  store,
  query,
  variables,
  options = { returnPartialData: true } as StoreReadOptions,
}: {
  store: NormalizedCache,
  query: Document,
  variables?: Object,
  options?: StoreReadOptions,
}): DiffResult {
  return diffSelectionSetAgainstStore({
    store,
    query,
    options,
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
  hasMissingField: boolean;
}

const readStoreResolver: Resolver = (
  fieldName: string,
  objId: string,
  args: any,
  context: ReadStoreContext
) => {
  const obj = context.store[objId];
  const storeKeyName = storeKeyNameFromFieldNameAndArgs(fieldName, args);
  const fieldValue = (obj || {})[storeKeyName];

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

    context.hasMissingField = true;

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
function diffSelectionSetAgainstStore({
  query,
  store,
  options,
  variables,
}: {
  query: Document,
  store: NormalizedCache,
  options: StoreReadOptions,
  variables: Object,
}): DiffResult {
  const context: ReadStoreContext = {
    store,
    throwOnMissingField: !options.returnPartialData,

    // Filled in during execution
    hasMissingField: false,
  };

  const result = graphqlAnywhere(
    readStoreResolver, query, 'ROOT_QUERY', context, variables, mapper);

  return {
    result,
    isMissing: context.hasMissingField,
  };
}
