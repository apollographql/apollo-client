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
  isField,
  isIdValue,
  isInlineFragment,
  isJsonValue,
  resultKeyNameFromField,
  shouldInclude,
  toIdValue,
} from 'apollo-utilities';

import {
  ReadStoreContext,
  StoreObject,
} from './types';

import { wrap, defaultMakeCacheKey } from './optimism';
import { DepTrackingCache } from './depTrackingCache';

export type VariableMap = { [name: string]: any };

export type FragmentMatcher = (
  rootValue: any,
  typeCondition: string,
  context: ReadStoreContext,
) => boolean | 'heuristic';

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

export type ExecResultMissingField = {
  objectId: string;
  fieldName: string;
  tolerable: boolean;
};

export type ExecResult<R = any> = {
  result: R;
  // Empty array if no missing fields encountered while computing result.
  missing?: ExecResultMissingField[];
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
  idValue: IdValue,
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
    return {
      result: fieldValue,
      missing: [{
        objectId: objId,
        fieldName: storeKeyName,
        tolerable: false,
      }],
    };
  }

  if (isJsonValue(fieldValue)) {
    fieldValue = fieldValue.json;
  }

  return {
    result: fieldValue,
  };
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
  rootValue: IdValue,
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
    rootValue: IdValue,
    context: ReadStoreContext,
    variables: VariableMap,
  ) {
    // The result of executeStoreQuery can be safely cached only if the
    // underlying store is capable of tracking dependencies and invalidating
    // the cache when relevant data have changed.
    if (context.store instanceof DepTrackingCache) {
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

const executeSelectionSet = wrap(function _executeSelectionSet(
  selectionSet: SelectionSetNode,
  rootValue: any,
  execContext: ExecContext,
): ExecResult {
  const { fragmentMap, contextValue, variableValues: variables } = execContext;
  const finalResult: ExecResult = {
    result: {},
  };

  function handleMissing<T>(result: ExecResult<T>): T {
    if (result.missing) {
      finalResult.missing = finalResult.missing || [];
      finalResult.missing.push(...result.missing);
    }
    return result.result;
  }

  selectionSet.selections.forEach(selection => {
    if (!shouldInclude(selection, variables)) {
      // Skip this entirely
      return;
    }

    if (isField(selection)) {
      const fieldResult = handleMissing(executeField(selection, rootValue, execContext));

      if (typeof fieldResult !== 'undefined') {
        merge(finalResult.result, {
          [resultKeyNameFromField(selection)]: fieldResult,
        });
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

      const match = execContext.fragmentMatcher(rootValue, typeCondition, contextValue);
      if (match) {
        let fragmentExecResult = executeSelectionSet(
          fragment.selectionSet,
          rootValue,
          execContext,
        );

        if (match === 'heuristic' && fragmentExecResult.missing) {
          fragmentExecResult = {
            ...fragmentExecResult,
            missing: fragmentExecResult.missing.map(info => {
              return { ...info, tolerable: true };
            }),
          };
        }

        merge(finalResult.result, handleMissing(fragmentExecResult));
      }
    }
  });

  return finalResult;

}, {
  makeCacheKey(
    selectionSet: SelectionSetNode,
    rootValue: any,
    context: ExecContext,
  ) {
    if (context.contextValue.store instanceof DepTrackingCache) {
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

function executeField(
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

  const readStoreResult = readStoreResolver(
    fieldName,
    rootValue,
    args,
    contextValue,
    info,
  );

  // Handle all scalar types here
  if (!field.selectionSet) {
    return readStoreResult;
  }

  // From here down, the field has a selection set, which means it's trying to
  // query a GraphQLObjectType
  if (readStoreResult.result == null) {
    // Basically any field in a GraphQL response can be null, or missing
    return readStoreResult;
  }

  function handleMissing<T>(res: ExecResult<T>): ExecResult<T> {
    let missing: ExecResultMissingField[] = null;

    if (readStoreResult.missing) {
      missing = missing || [];
      missing.push(...readStoreResult.missing);
    }

    if (res.missing) {
      missing = missing || [];
      missing.push(...res.missing);
    }

    return {
      result: res.result,
      missing,
    };
  }

  if (Array.isArray(readStoreResult.result)) {
    return handleMissing(executeSubSelectedArray(
      field,
      readStoreResult.result,
      execContext,
    ));
  }

  // Returned value is an object, and the query has a sub-selection. Recurse.
  return handleMissing(executeSelectionSet(
    field.selectionSet,
    readStoreResult.result,
    execContext,
  ));
}

function executeSubSelectedArray(
  field: FieldNode,
  result: any[],
  execContext: ExecContext,
): ExecResult {
  let missing: ExecResultMissingField[] = null;

  function handleMissing<T>(childResult: ExecResult<T>): T {
    if (childResult.missing) {
      missing = missing || [];
      missing.push(...childResult.missing);
    }

    return childResult.result;
  }

  result = result.map(item => {
    // null value in array
    if (item === null) {
      return null;
    }

    // This is a nested array, recurse
    if (Array.isArray(item)) {
      return handleMissing(executeSubSelectedArray(field, item, execContext));
    }

    // This is an object, run the selection set on it
    return handleMissing(executeSelectionSet(field.selectionSet, item, execContext));
  });

  return { result, missing };
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
