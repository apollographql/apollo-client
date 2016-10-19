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
  IdValue,
} from './storeUtils';

import {
  storeKeyNameFromFieldNameAndArgs,
} from './storeUtils';

import {
  getQueryDefinition,
} from '../queries/getFromAST';

import {
  ApolloReducerConfig,
} from '../store';

export type DiffResult = {
  result?: any;
  isMissing?: boolean;
}

export type ReadQueryOptions = {
  store: NormalizedCache,
  query: Document,
  variables?: Object,
  returnPartialData?: boolean,
  config?: ApolloReducerConfig,
}

export type CustomResolver = (rootValue: any, args: { [argName: string]: any }) => any;

export type CustomResolverMap = {
  [typeName: string]: {
    [fieldName: string]: CustomResolver
  }
};

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
  config,
}: ReadQueryOptions): Object {
  const { result } = diffQueryAgainstStore({
    query,
    store,
    returnPartialData,
    variables,
    config,
  });

  return result;
}

type ReadStoreContext = {
  store: NormalizedCache;
  returnPartialData: boolean;
  hasMissingField: boolean;
  customResolvers: CustomResolverMap;
}

let haveWarned = false;

const fragmentMatcher: FragmentMatcher = (
  idValue: IdValue,
  typeCondition: string,
  context: ReadStoreContext
): boolean => {
  assertIdValue(idValue);

  const obj = context.store[idValue.id];

  if (! obj) {
    return false;
  }

  if (! obj.__typename) {
    if (! haveWarned) {
      console.warn(`You're using fragments in your queries, but don't have the addTypename:
true option set in Apollo Client. Please turn on that option so that we can accurately
match fragments.`);

      /* istanbul ignore if */
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

  // XXX here we reach an issue - we don't know if this fragment should match or not. It's either:
  // 1. A fragment on a non-matching concrete type or interface or union
  // 2. A fragment on a matching interface or union
  // If it's 1, we don't want to return anything, if it's 2 we want to match. We can't tell the
  // difference, so for now, we just do our best to resolve the fragment but turn on partial data
  context.returnPartialData = true;
  return true;
};

const readStoreResolver: Resolver = (
  fieldName: string,
  idValue: IdValue,
  args: any,
  context: ReadStoreContext
) => {
  assertIdValue(idValue);

  const objId = idValue.id;
  const obj = context.store[objId];
  const storeKeyName = storeKeyNameFromFieldNameAndArgs(fieldName, args);
  const fieldValue = (obj || {})[storeKeyName];

  if (typeof fieldValue === 'undefined') {
    if (obj && (obj.__typename || objId === 'ROOT_QUERY')) {
      const typename = obj.__typename || 'Query';

      // Look for the type in the custom resolver map
      const type = context.customResolvers[typename];
      if (type) {
        // Look for the field in the custom resolver map
        const resolver = type[fieldName];
        if (resolver) {
          return resolver(obj, args);
        }
      }
    }

    if (! context.returnPartialData) {
      throw new Error(`Can't find field ${storeKeyName} on object (${objId}) ${JSON.stringify(obj, null, 2)}.
Perhaps you want to use the \`returnPartialData\` option?`);
    }

    context.hasMissingField = true;

    return fieldValue;
  }

  if (isJsonValue(fieldValue)) {
    // if this is an object scalar, it must be a json blob and we have to unescape it
    return fieldValue.json;
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
  config,
}: ReadQueryOptions): DiffResult {
  // Throw the right validation error by trying to find a query in the document
  getQueryDefinition(query);

  const context: ReadStoreContext = {
    // Global settings
    store,
    returnPartialData,
    customResolvers: config.customResolvers,

    // Flag set during execution
    hasMissingField: false,
  };

  const rootIdValue = {
    type: 'id',
    id: 'ROOT_QUERY',
  };

  const result = graphqlAnywhere(readStoreResolver, query, rootIdValue, context, variables, {
    fragmentMatcher,
  });

  return {
    result,
    isMissing: context.hasMissingField,
  };
}

function assertIdValue(idValue: IdValue) {
  if (! isIdValue(idValue)) {
    throw new Error(`Encountered a sub-selection on the query, but the store doesn't have \
an object reference. This should never happen during normal use unless you have custom code \
that is directly manipulating the store; please file an issue.`);
  }
}
