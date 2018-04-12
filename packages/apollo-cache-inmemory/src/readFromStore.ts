import queryStore from './queryStore';

import {
  assign,
  getDefaultValues,
  getQueryDefinition,
} from 'apollo-utilities';

import { Cache } from 'apollo-cache';

import {
  IdValueWithPreviousResult,
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

  const result = queryStore(
    query,
    rootIdValue,
    context,
    variables,
    {
      fragmentMatcher: fragmentMatcherFunction,
      resultMapper,
    },
  );

  return {
    result: result as T,
    complete: !context.hasMissingField,
  };
}

/**
 * Maps a result from `graphql-anywhere` to a final result value.
 *
 * If the result and the previous result from the `idValue` pass a shallow equality test, we just
 * return the `previousResult` to maintain referential equality.
 *
 * We also add a private id property to the result that we can use later on.
 *
 * @private
 */
function resultMapper(resultFields: any, idValue: IdValueWithPreviousResult) {
  // If we had a previous result, we may be able to return that and preserve referential equality
  if (idValue.previousResult) {
    const currentResultKeys = Object.keys(resultFields);

    const sameAsPreviousResult =
      // Confirm that we have the same keys in both the current result and the previous result.
      Object.keys(idValue.previousResult).every(
        key => currentResultKeys.indexOf(key) > -1,
      ) &&
      // Perform a shallow comparison of the result fields with the previous result. If all of
      // the shallow fields are referentially equal to the fields of the previous result we can
      // just return the previous result.
      //
      // While we do a shallow comparison of objects, but we do a deep comparison of arrays.
      currentResultKeys.every(key =>
        areNestedArrayItemsStrictlyEqual(
          resultFields[key],
          idValue.previousResult[key],
        ),
      );

    if (sameAsPreviousResult) {
      return idValue.previousResult;
    }
  }

  Object.defineProperty(resultFields, ID_KEY, {
    enumerable: false,
    configurable: true,
    writable: false,
    value: idValue.id,
  });

  return resultFields;
}

type NestedArray<T> = T | Array<T | Array<T | Array<T>>>;

/**
 * Compare all the items to see if they are all referentially equal in two arrays no matter how
 * deeply nested the arrays are.
 *
 * @private
 */
function areNestedArrayItemsStrictlyEqual(
  a: NestedArray<any>,
  b: NestedArray<any>,
): boolean {
  // If `a` and `b` are referentially equal, return true.
  if (a === b) {
    return true;
  }
  // If either `a` or `b` are not an array or not of the same length return false. `a` and `b` are
  // known to not be equal here, we checked above.
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
    return false;
  }
  // Otherwise let us compare all of the array items (which are potentially nested arrays!) to see
  // if they are equal.
  return a.every((item, i) => areNestedArrayItemsStrictlyEqual(item, b[i]));
}
