import {
  Document,
} from 'graphql';

import graphqlAnywhere, {
  Resolver,
  FragmentMatcher,
} from 'graphql-anywhere';

import {
  NormalizedCache,
  isJsonValue,
  isIdValue,
} from './store';

import {
  storeKeyNameFromFieldNameAndArgs,
} from './storeUtils';

import {
  ApolloError,
} from '../errors/ApolloError';

export type DiffResult = {
  result?: any;
  isMissing?: boolean;
}

export type ReadQueryOptions = {
  store: NormalizedCache,
  query: Document,
  variables?: Object,
  returnPartialData?: boolean,
}

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
 */
export function readQueryFromStore({
  store,
  query,
  variables,
  returnPartialData = false,
}: ReadQueryOptions): Object {
  const { result } = diffQueryAgainstStore({
    query,
    store,
    returnPartialData,
    variables,
  });

  return result;
}

type ReadStoreContext = {
  store: NormalizedCache;
  returnPartialData: boolean;
  hasMissingField: boolean;
}

let haveWarned = false;

const fragmentMatcher: FragmentMatcher = (
  objId: string,
  typeCondition: string,
  context: ReadStoreContext
): boolean => {
  const obj = context.store[objId];

  if (! obj) {
    return false;
  }

  if (! obj.__typename) {
    if (! haveWarned) {
      console.warn(`You're using fragments in your queries, but don't have the addTypename:
true option set in Apollo Client. Please turn on that option so that we can accurately
match fragments.`);
      if (process.env.NODE_ENV !== 'test') {
        // When running tests, we want to print the warning every time
        haveWarned = true;
      }
    }

    context.returnPartialData = true;

    return true;
  }

  if (obj.__typename === typeCondition) {
    return true;
  }

  // XXX interfaces and unions
  console.log("XXXXX")
  return false;
};

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
    if (! context.returnPartialData) {
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

/**
 * Given a store and a query, return as much of the result as possible and
 * identify if any data was missing from the store.
 * @param  {Document} query A parsed GraphQL query document
 * @param  {Store} store The Apollo Client store object
 * @param  {boolean} [returnPartialData] Whether to throw an error if any fields are missing
 * @return {result: Object, isMissing: [boolean]}
 */
export function diffQueryAgainstStore({
  store,
  query,
  variables,
  returnPartialData = true,
}: ReadQueryOptions): DiffResult {
  const context: ReadStoreContext = {
    store,
    returnPartialData,

    // Filled in during execution
    hasMissingField: false,
  };

  const result = graphqlAnywhere(readStoreResolver, query, 'ROOT_QUERY', context, variables, {
    fragmentMatcher,
  });

  return {
    result,
    isMissing: context.hasMissingField,
  };
}
