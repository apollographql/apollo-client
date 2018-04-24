import {
  DocumentNode,
  FieldNode,
  FragmentDefinitionNode,
  InlineFragmentNode,
  SelectionSetNode,
} from 'graphql';

import {
  DirectiveInfo,
  FragmentMap,
  IdValue,
  StoreValue,
  argumentsObjectFromField,
  createFragmentMap,
  getDirectiveInfoFromField,
  getFragmentDefinitions,
  getMainDefinition,
  getStoreKeyName,
  isEqual,
  isField,
  isIdValue,
  isInlineFragment,
  isJsonValue,
  resultKeyNameFromField,
  shouldInclude,
  toIdValue,
} from 'apollo-utilities';

import {
  IdValueWithPreviousResult,
  ReadStoreContext,
  StoreObject,
} from './types';

import { wrap, defaultMakeCacheKey } from './optimism';
import { OptimisticObjectCache } from './optimisticObjectCache';

/**
 * The key which the cache id for a given value is stored in the result object. This key is private
 * and should not be used by Apollo client users.
 *
 * Uses a symbol if available in the environment.
 *
 * @private
 */
export const ID_KEY = typeof Symbol !== 'undefined' ? Symbol('id') : '@@id';

export type VariableMap = { [name: string]: any };

export type FragmentMatcher = (
  rootValue: any,
  typeCondition: string,
  context: ReadStoreContext,
) => boolean;

type ExecContext = {
  fragmentMap: FragmentMap;
  contextValue: ReadStoreContext;
  variableValues: VariableMap;
  fragmentMatcher: FragmentMatcher;
};

type ExecInfo = {
  resultKey: string;
  directives: DirectiveInfo;
};

export type ExecResult<R = any> = {
  result: R;
  // True if no missing fields were encountered while computing the result.
  complete: boolean;
};

export function assertIdValue(idValue: IdValue) {
  if (!isIdValue(idValue)) {
    throw new Error(`Encountered a sub-selection on the query, but the store doesn't have \
an object reference. This should never happen during normal use unless you have custom code \
that is directly manipulating the store; please file an issue.`);
  }
}

function readStoreResolver(
  fieldName: string,
  idValue: IdValueWithPreviousResult,
  args: any,
  context: ReadStoreContext,
  { resultKey, directives }: ExecInfo,
): ExecResult<StoreValue> {
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

  let fieldValue: StoreValue | void = void 0;

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

    return {
      result: fieldValue,
      complete: false,
    };
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
      return {
        result: idValue.previousResult[resultKey],
        complete: true,
      };
    }

    return {
      result: fieldValue.json,
      complete: true,
    };
  }

  // If we had a previous result, try adding that previous result value for this field to our field
  // value. This will create a new value without mutating the old one.
  if (idValue.previousResult) {
    fieldValue = addPreviousResultToIdValues(
      fieldValue,
      idValue.previousResult[resultKey],
    );
  }

  return {
    result: fieldValue,
    complete: true,
  };
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

/* Based on graphql function from graphql-js:
 *
 * graphql(
 *   schema: GraphQLSchema,
 *   requestString: string,
 *   rootValue?: ?any,
 *   contextValue?: ?any,
 *   variableValues?: ?{[key: string]: any},
 *   operationName?: ?string
 * ): Promise<GraphQLResult>
 *
 * The default export as of graphql-anywhere is sync as of 4.0,
 * but below is an exported alternative that is async.
 * In the 5.0 version, this will be the only export again
 * and it will be async
 *
 */
export default wrap(function executeStoreQuery(
  query: DocumentNode,
  rootValue: IdValueWithPreviousResult,
  contextValue: ReadStoreContext,
  variableValues: VariableMap,
  // Default matcher always matches all fragments
  fragmentMatcher: FragmentMatcher = defaultFragmentMatcher,
): ExecResult {
  const mainDefinition = getMainDefinition(query);
  const fragments = getFragmentDefinitions(query);
  const fragmentMap = createFragmentMap(fragments);
  const execContext: ExecContext = {
    fragmentMap,
    contextValue,
    variableValues,
    fragmentMatcher,
  };

  return executeSelectionSet(
    mainDefinition.selectionSet,
    rootValue,
    execContext,
  );
}, {
  makeCacheKey(
    query: DocumentNode,
    rootValue: IdValueWithPreviousResult,
    context: ReadStoreContext,
    variables: VariableMap,
  ) {
    // TODO Figure out how to handle previous results in a way that is
    // compatible with optimistic caching.
    if (rootValue.previousResult) {
      return;
    }

    // TODO Figure out how to disable returning partial data in a way that is
    // compatible with optimistic caching.
    if (!context.returnPartialData) {
      return;
    }

    // The result of executeStoreQuery can be safely cached only if the
    // underlying store is capable of tracking dependencies and invalidating
    // the cache when relevant data have changed.
    if (context.store instanceof OptimisticObjectCache) {
      return defaultMakeCacheKey(
        query,
        context.store,
        JSON.stringify(variables),
      );
    }
  }
});

function defaultFragmentMatcher() {
  return true;
}

const executeSelectionSet = wrap(function (
  selectionSet: SelectionSetNode,
  rootValue: any,
  execContext: ExecContext,
): ExecResult {
  const { fragmentMap, contextValue, variableValues: variables } = execContext;
  const result: { [key: string]: any } = {};
  let complete = true;

  selectionSet.selections.forEach(selection => {
    if (!shouldInclude(selection, variables)) {
      // Skip this entirely
      return;
    }

    if (isField(selection)) {
      const { result: fieldResult, complete: fieldComplete } = executeField(
        selection,
        rootValue,
        execContext,
      );

      if (!fieldComplete) {
        complete = false;
      }

      const resultFieldKey = resultKeyNameFromField(selection);

      if (fieldResult !== undefined) {
        if (result[resultFieldKey] === undefined) {
          result[resultFieldKey] = fieldResult;
        } else {
          merge(result[resultFieldKey], fieldResult);
        }
      }
    } else {
      let fragment: InlineFragmentNode | FragmentDefinitionNode;

      if (isInlineFragment(selection)) {
        fragment = selection;
      } else {
        // This is a named fragment
        fragment = fragmentMap[selection.name.value];

        if (!fragment) {
          throw new Error(`No fragment named ${selection.name.value}`);
        }
      }

      const typeCondition = fragment.typeCondition.name.value;

      if (execContext.fragmentMatcher(rootValue, typeCondition, contextValue)) {
        const {
          result: fragmentResult,
          complete: fragmentComplete,
        } = executeSelectionSet(fragment.selectionSet, rootValue, execContext);

        if (!fragmentComplete) {
          complete = false;
        }

        merge(result, fragmentResult);
      }
    }
  });

  return {
    result: resultMapper(result, rootValue),
    complete,
  };
}, {
  makeCacheKey(
    selectionSet: SelectionSetNode,
    rootValue: any,
    context: ExecContext,
  ) {
    if (!rootValue.previousResult &&
        context.contextValue.returnPartialData &&
        context.contextValue.store instanceof OptimisticObjectCache) {
      return defaultMakeCacheKey(
        selectionSet,
        context.contextValue.store,
        JSON.stringify(context.variableValues),
        // Unlike executeStoreQuery, executeSelectionSet can be called
        // recursively on nested objects, so it's important to include the
        // ID of the current parent object in the cache key.
        rootValue.id,
      );
    }
  }
});

const executeField = wrap(function (
  field: FieldNode,
  rootValue: any,
  execContext: ExecContext,
): ExecResult {
  const { variableValues: variables, contextValue } = execContext;
  const fieldName = field.name.value;
  const args = argumentsObjectFromField(field, variables);

  const info: ExecInfo = {
    resultKey: resultKeyNameFromField(field),
    directives: getDirectiveInfoFromField(field, variables),
  };

  const { result, complete } = readStoreResolver(
    fieldName,
    rootValue,
    args,
    contextValue,
    info,
  );

  // Handle all scalar types here
  if (!field.selectionSet) {
    return { result, complete };
  }

  // From here down, the field has a selection set, which means it's trying to
  // query a GraphQLObjectType
  if (result == null) {
    // Basically any field in a GraphQL response can be null, or missing
    return { result, complete };
  }

  function finish(res: ExecResult): ExecResult {
    return {
      result: res.result,
      complete: complete && res.complete,
    };
  }

  if (Array.isArray(result)) {
    return finish(executeSubSelectedArray(field, result, execContext));
  }

  // Returned value is an object, and the query has a sub-selection. Recurse.
  return finish(executeSelectionSet(field.selectionSet, result, execContext));
}, {
  makeCacheKey(
    field: FieldNode,
    rootValue: any,
    execContext: ExecContext,
  ) {
    if (execContext.contextValue.returnPartialData &&
        execContext.contextValue.store instanceof OptimisticObjectCache) {
      return defaultMakeCacheKey(
        field,
        execContext.contextValue.store,
        JSON.stringify(execContext.variableValues),
        rootValue.id,
      );
    }
  }
});

function executeSubSelectedArray(
  field: FieldNode,
  result: any[],
  execContext: ExecContext,
): ExecResult {
  let complete = true;

  function finish<T>(res: ExecResult<T>): T {
    if (!res.complete) {
      complete = false;
    }
    return res.result;
  }

  result = result.map(item => {
    // null value in array
    if (item === null) {
      return null;
    }

    // This is a nested array, recurse
    if (Array.isArray(item)) {
      return finish(executeSubSelectedArray(field, item, execContext));
    }

    // This is an object, run the selection set on it
    return finish(executeSelectionSet(field.selectionSet, item, execContext));
  });

  return { result, complete };
}

const hasOwn = Object.prototype.hasOwnProperty;

function merge(
  target: { [key: string]: any },
  source: { [key: string]: any },
) {
  if (source !== null && typeof source === 'object') {
    Object.keys(source).forEach(sourceKey => {
      const sourceVal = source[sourceKey];
      if (!hasOwn.call(target, sourceKey)) {
        target[sourceKey] = sourceVal;
      } else {
        merge(target[sourceKey], sourceVal);
      }
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
