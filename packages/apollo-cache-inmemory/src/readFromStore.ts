import executeStoreQuery from './executeStoreQuery';

import {
  assign,
  getDefaultValues,
  getQueryDefinition,
} from 'apollo-utilities';

import { Cache } from 'apollo-cache';

import {
  ReadStoreContext,
  DiffQueryAgainstStoreOptions,
  ReadQueryOptions,
} from './types';

/**
 * The key which the cache id for a given value is stored in the result object. This key is private
 * and should not be used by Apollo client users.
 *
 * Uses a symbol if available in the environment.
 *
 * @private
 */
export const ID_KEY = typeof Symbol !== 'undefined' ? Symbol('id') : '@@id';

/**
 * Resolves the result of a query solely from the store (i.e. never hits the server).
 *
 * @param {Store} store The {@link NormalizedCache} used by Apollo for the `data` portion of the
 * store.
 *
 * @param {DocumentNode} query The query document to resolve from the data available in the store.
 *
 * @param {Object} [variables] A map from the name of a variable to its value. These variables can
 * be referenced by the query document.
 *
 * @param {any} previousResult The previous result returned by this function for the same query.
 * If nothing in the store changed since that previous result then values from the previous result
 * will be returned to preserve referential equality.
 */
export function readQueryFromStore<QueryType>(
  options: ReadQueryOptions,
): QueryType {
  const optsPatch = { returnPartialData: false };

  return diffQueryAgainstStore<QueryType>({
    ...options,
    ...optsPatch,
  }).result;
}

/**
 * Given a store and a query, return as much of the result as possible and
 * identify if any data was missing from the store.
 * @param  {DocumentNode} query A parsed GraphQL query document
 * @param  {Store} store The Apollo Client store object
 * @param  {any} previousResult The previous result returned by this function for the same query
 * @return {result: Object, complete: [boolean]}
 */
export function diffQueryAgainstStore<T>({
  store,
  query,
  variables,
  previousResult,
  returnPartialData = true,
  rootId = 'ROOT_QUERY',
  fragmentMatcherFunction,
  config,
}: DiffQueryAgainstStoreOptions): Cache.DiffResult<T> {
  // Throw the right validation error by trying to find a query in the document
  const queryDefinition = getQueryDefinition(query);

  variables = assign({}, getDefaultValues(queryDefinition), variables);

  const context: ReadStoreContext = {
    // Global settings
    store,
    returnPartialData,
    dataIdFromObject: (config && config.dataIdFromObject) || null,
    cacheRedirects: (config && config.cacheRedirects) || {},
    // Flag set during execution
    hasMissingField: false,
  };

  const rootIdValue = {
    type: 'id',
    id: rootId,
    previousResult,
  };

  const result = executeStoreQuery(
    query,
    rootIdValue,
    context,
    variables,
    fragmentMatcherFunction,
  );

  return {
    result: result as T,
    complete: !context.hasMissingField,
  };
}
