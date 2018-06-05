import graphqlAnywhere, { Resolver, ExecInfo } from 'graphql-anywhere';

import {
  IdValue,
  assign,
  isEqual,
  getDefaultValues,
  getQueryDefinition,
  isJsonValue,
  isIdValue,
  toIdValue,
  getStoreKeyName,
  StoreValue,
} from 'apollo-utilities';

import { Cache } from 'apollo-cache';

import {
  ReadQueryOptions,
  IdValueWithPreviousResult,
  ReadStoreContext,
  DiffQueryAgainstStoreOptions,
  StoreObject,
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

const readStoreResolver: Resolver = (
  fieldName: string,
  idValue: IdValueWithPreviousResult,
  args: any,
  context: ReadStoreContext,
  { resultKey, directives }: ExecInfo,
) => {
  assertIdValue(idValue);

  const objId = idValue.id;
  const obj = context.store.get(objId);

  let storeKeyName = fieldName;
  if (args || directives) {
    // We happen to know here that getStoreKeyName returns its first
    // argument unmodified if there are no args or directives, so we can
    // avoid calling the function at all in that case, as a small but
    // important optimization to this frequently executed code.
    storeKeyName = getStoreKeyName(storeKeyName, args, directives);
  }

  let fieldValue: StoreValue | string | void = void 0;

  if (obj) {
    fieldValue = obj[storeKeyName];

    if (
      typeof fieldValue === 'undefined' &&
      context.cacheRedirects &&
      (obj.__typename || objId === 'ROOT_QUERY')
    ) {
      const typename = obj.__typename || 'Query';

      // Look for the type in the custom resolver map
      const type = context.cacheRedirects[typename];
      if (type) {
        // Look for the field in the custom resolver map
        const resolver = type[fieldName];
        if (resolver) {
          fieldValue = resolver(obj, args, {
            getCacheKey(storeObj: StoreObject) {
              return toIdValue({
                id: context.dataIdFromObject(storeObj),
                typename: storeObj.__typename,
              });
            },
          });
        }
      }
    }
  }

  if (typeof fieldValue === 'undefined') {
    if (!context.returnPartialData) {
      throw new Error(
        `Can't find field ${storeKeyName} on object (${objId}) ${JSON.stringify(
          obj,
          null,
          2,
        )}.`,
      );
    }

    context.hasMissingField = true;

    return fieldValue;
  }

  // if this is an object scalar, it must be a json blob and we have to unescape it
  if (isJsonValue(fieldValue)) {
    // If the JSON blob is the same now as in the previous result, return the previous result to
    // maintain referential equality.
    //
    // `isEqual` will first perform a referential equality check (with `===`) in case the JSON
    // value has not changed in the store, and then a deep equality check if that fails in case a
    // new JSON object was returned by the API but that object may still be the same.
    if (
      idValue.previousResult &&
      isEqual(idValue.previousResult[resultKey], fieldValue.json)
    ) {
      return idValue.previousResult[resultKey];
    }
    return fieldValue.json;
  }

  // If we had a previous result, try adding that previous result value for this field to our field
  // value. This will create a new value without mutating the old one.
  if (idValue.previousResult) {
    fieldValue = addPreviousResultToIdValues(
      fieldValue,
      idValue.previousResult[resultKey],
    );
  }

  return fieldValue;
};

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

  const result = graphqlAnywhere(
    readStoreResolver,
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

export function assertIdValue(idValue: IdValue) {
  if (!isIdValue(idValue)) {
    throw new Error(`Encountered a sub-selection on the query, but the store doesn't have \
an object reference. This should never happen during normal use unless you have custom code \
that is directly manipulating the store; please file an issue.`);
  }
}

/**
 * Adds a previous result value to id values in a nested array. For a single id value and a single
 * previous result then the previous value is added directly.
 *
 * For arrays we put all of the ids from the previous result array in a map and add them to id
 * values with the same id.
 *
 * This function does not mutate. Instead it returns new instances of modified values.
 *
 * @private
 */
function addPreviousResultToIdValues(value: any, previousResult: any): any {
  // If the value is an `IdValue`, add the previous result to it whether or not that
  // `previousResult` is undefined.
  //
  // If the value is an array, recurse over each item trying to add the `previousResult` for that
  // item.
  if (isIdValue(value)) {
    return {
      ...value,
      previousResult,
    };
  } else if (Array.isArray(value)) {
    const idToPreviousResult: Map<string, any> = new Map();

    // If the previous result was an array, we want to build up our map of ids to previous results
    // using the private `ID_KEY` property that is added in `resultMapper`.
    if (Array.isArray(previousResult)) {
      previousResult.forEach(item => {
        // item can be null
        if (item && item[ID_KEY]) {
          idToPreviousResult.set(item[ID_KEY], item);
          // idToPreviousResult[item[ID_KEY]] = item;
        }
      });
    }

    // For every value we want to add the previous result.
    return value.map((item, i) => {
      // By default the previous result for this item will be in the same array position as this
      // item.
      let itemPreviousResult = previousResult && previousResult[i];

      // If the item is an id value, we should check to see if there is a previous result for this
      // specific id. If there is, that will be the value for `itemPreviousResult`.
      if (isIdValue(item)) {
        itemPreviousResult =
          idToPreviousResult.get(item.id) || itemPreviousResult;
      }

      return addPreviousResultToIdValues(item, itemPreviousResult);
    });
  }
  // Return the value, nothing changed.
  return value;
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
