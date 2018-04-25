import executeStoreQuery from './executeStoreQuery';

import {
  assign,
  getDefaultValues,
  getQueryDefinition,
  isEqual,
} from 'apollo-utilities';

import { Cache } from 'apollo-cache';

import {
  ReadStoreContext,
  DiffQueryAgainstStoreOptions,
  ReadQueryOptions,
} from './types';

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
    dataIdFromObject: (config && config.dataIdFromObject) || null,
    cacheRedirects: (config && config.cacheRedirects) || {},
  };

  const execResult = executeStoreQuery(
    query,
    {
      type: 'id',
      id: rootId,
      generated: true,
      typename: 'Query',
    },
    context,
    variables,
    fragmentMatcherFunction,
  );

  const hasMissingFields =
    execResult.missing && execResult.missing.length > 0;

  if (hasMissingFields && ! returnPartialData) {
    execResult.missing.forEach(info => {
      if (info.tolerable) return;
      throw new Error(
        `Can't find field ${info.fieldName} on object (${info.objectId}) ${
          JSON.stringify(store.get(info.objectId), null, 2)
        }.`
      );
    });
  }

  if (previousResult) {
    if (isEqual(previousResult, execResult.result)) {
      execResult.result = previousResult;
    }
  }

  return {
    result: execResult.result,
    complete: !hasMissingFields,
  };
}
