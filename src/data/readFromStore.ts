import {
  DocumentNode,
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

import { isEqual } from '../util/isEqual';

/**
 * The key which the cache id for a given value is stored in the result object. This key is private
 * and should not be used by Apollo client users.
 *
 * Uses a symbol if available in the environment.
 *
 * @private
 */
export const ID_KEY = typeof Symbol !== 'undefined' ? Symbol('id') : '@@id';

export type DiffResult = {
  result?: any;
  isMissing?: boolean;
};

export type ReadQueryOptions = {
  store: NormalizedCache,
  query: DocumentNode,
  variables?: Object,
  returnPartialData?: boolean,
  previousResult?: any,
  config?: ApolloReducerConfig,
};

export type CustomResolver = (rootValue: any, args: { [argName: string]: any }) => any;

export type CustomResolverMap = {
  [typeName: string]: {
    [fieldName: string]: CustomResolver,
  },
};

interface IdValueWithPreviousResult extends IdValue {
  previousResult?: any;
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
};

let haveWarned = false;

const fragmentMatcher: FragmentMatcher = (
  idValue: IdValue,
  typeCondition: string,
  context: ReadStoreContext,
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
  idValue: IdValueWithPreviousResult,
  args: any,
  context: ReadStoreContext,
) => {
  assertIdValue(idValue);

  const objId = idValue.id;
  const obj = context.store[objId];
  const storeKeyName = storeKeyNameFromFieldNameAndArgs(fieldName, args);
  const fieldValue = (obj || {})[storeKeyName];

  if (typeof fieldValue === 'undefined') {
    if (context.customResolvers && obj && (obj.__typename || objId === 'ROOT_QUERY')) {
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

  // if this is an object scalar, it must be a json blob and we have to unescape it
  if (isJsonValue(fieldValue)) {
    // If the JSON blob is the same now as in the previous result, return the previous result to
    // maintain referential equality.
    if (idValue.previousResult && isEqual(idValue.previousResult[fieldName], fieldValue.json)) {
      return idValue.previousResult[fieldName];
    }
    return fieldValue.json;
  }

  // If we had a previous result, try adding that previous result value for this field to our field
  // value.
  if (idValue.previousResult) {
    addPreviousResultToIdValues(fieldValue, idValue.previousResult[fieldName]);
  }

  return fieldValue;
};

/**
 * Adds a previous result value to id values in a nested array. For a single id value and a single
 * previous result then the previous value is added directly.
 *
 * For arrays we put all of the ids from the previous result array in a map and add them to id
 * values with the same id.
 *
 * @private
 */
function addPreviousResultToIdValues (value: any, previousResult: any) {
  // If the value is an `IdValue`, add the previous result to it whether or not that
  // `previousResult` is undefined.
  //
  // If the value is an array, recurse over each item trying to add the `previousResult` for that
  // item.
  if (isIdValue(value)) {
    (value as IdValueWithPreviousResult).previousResult = previousResult;
  } else if (Array.isArray(value)) {
    const idToPreviousResult: { [id: string]: any } = {};

    // If the previous result was an array, we want to build up our map of ids to previous results
    // using the private `ID_KEY` property that is added in `resultMapper`.
    if (Array.isArray(previousResult)) {
      previousResult.forEach(item => {
        if (item[ID_KEY]) {
          idToPreviousResult[item[ID_KEY]] = item;
        }
      });
    }

    // For every value we want to add the previous result.
    value.forEach((item, i) => {
      // By default the previous result for this item will be in the same array position as this
      // item.
      let itemPreviousResult = previousResult && previousResult[i];

      // If the item is an id value, we should check to see if there is a previous result for this
      // specific id. If there is, that will be the value for `itemPreviousResult`.
      if (isIdValue(item)) {
        itemPreviousResult = idToPreviousResult[item.id] || itemPreviousResult;
      }

      addPreviousResultToIdValues(item, itemPreviousResult);
    });
  }
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
function resultMapper (resultFields: any, idValue: IdValueWithPreviousResult) {
  // If we had a previous result, we may be able to return that and preserve referential equality
  if (idValue.previousResult) {
    // Perform a shallow comparison of the result fields with the previous result. If all of
    // the shallow fields are referentially equal to the fields of the previous result we can
    // just return the previous result.
    //
    // While we do a shallow comparison of objects, we do a deep comparison of arrays.
    const sameAsPreviousResult = Object.keys(resultFields).reduce((same, key) => {
      if (!same) {
        return false;
      }

      // Flatten out the field values before comparing them. Non-arrays will turn into singleton
      // arrays and multi-dimensional arrays will be flattened out. Depth doesn’t matter in this
      // case, we just need to check that all items are equal.
      const next = flattenArray(resultFields[key]);
      const previous = flattenArray(idValue.previousResult[key]);

      return next.reduce((fieldSame, item, i) => fieldSame && item === previous[i], true);
    }, true);

    if (sameAsPreviousResult) {
      return idValue.previousResult;
    }
  }

  // Add the id to the result fields. It should be non-enumerable so users can’t see it without
  // trying very hard.
  Object.defineProperty(resultFields, ID_KEY, {
    enumerable: false,
    configurable: false,
    writable: false,
    value: idValue.id,
  });

  return resultFields;
}

/**
 * Given a store and a query, return as much of the result as possible and
 * identify if any data was missing from the store.
 * @param  {DocumentNode} query A parsed GraphQL query document
 * @param  {Store} store The Apollo Client store object
 * @param  {boolean} [returnPartialData] Whether to throw an error if any fields are missing
 * @param  {any} previousResult The previous result returned by this function for the same query
 * @return {result: Object, isMissing: [boolean]}
 */
export function diffQueryAgainstStore({
  store,
  query,
  variables,
  returnPartialData = true,
  previousResult,
  config,
}: ReadQueryOptions): DiffResult {
  // Throw the right validation error by trying to find a query in the document
  getQueryDefinition(query);

  const context: ReadStoreContext = {
    // Global settings
    store,
    returnPartialData,
    customResolvers: config && config.customResolvers,

    // Flag set during execution
    hasMissingField: false,
  };

  const rootIdValue = {
    type: 'id',
    id: 'ROOT_QUERY',
    previousResult,
  };

  const result = graphqlAnywhere(readStoreResolver, query, rootIdValue, context, variables, {
    fragmentMatcher,
    resultMapper,
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

type NestedArray<T> = T | Array<T | Array<T | Array<T>>>;

function flattenArray <T>(nestedArray: NestedArray<T>): Array<T> {
  if (!Array.isArray(nestedArray)) {
    return [nestedArray];
  }
  return nestedArray.reduce((flatArray: Array<T>, item: NestedArray<T>): Array<T> => (
    [...flatArray, ...(Array.isArray(item) ? flattenArray(item) : [item])]
  ), []) as Array<T>;
}
