import {
  assign,
  getDefaultValues,
  getQueryDefinition,
  isEqual,
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

import { Cache } from 'apollo-cache';

import {
  ReadStoreContext,
  DiffQueryAgainstStoreOptions,
  ReadQueryOptions,
  StoreObject,
} from './types';

import {
  DocumentNode,
  FieldNode,
  FragmentDefinitionNode,
  InlineFragmentNode,
  SelectionSetNode,
} from 'graphql';

import { wrap } from 'optimism';
import { CacheKeyNode } from './cacheKeys';
import { DepTrackingCache } from './depTrackingCache';

export type VariableMap = { [name: string]: any };

export type FragmentMatcher = (
  rootValue: any,
  typeCondition: string,
  context: ReadStoreContext,
) => boolean | 'heuristic';

type ExecContext = {
  query: DocumentNode;
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
  object: StoreObject;
  fieldName: string;
  tolerable: boolean;
};

export type ExecResult<R = any> = {
  result: R;
  // Empty array if no missing fields encountered while computing result.
  missing?: ExecResultMissingField[];
};

type ExecStoreQueryOptions = {
  query: DocumentNode;
  rootValue: IdValue;
  contextValue: ReadStoreContext;
  variableValues: VariableMap;
  // Default matcher always matches all fragments
  fragmentMatcher: FragmentMatcher;
};

type ExecSelectionSetOptions = {
  selectionSet: SelectionSetNode;
  rootValue: any;
  execContext: ExecContext;
};

export class StoreReader {
  constructor(private cacheKeyRoot = new CacheKeyNode()) {
    const reader = this;
    const { executeStoreQuery, executeSelectionSet } = reader;

    this.executeStoreQuery = wrap(
      (options: ExecStoreQueryOptions) => {
        return executeStoreQuery.call(this, options);
      },
      {
        makeCacheKey({
          query,
          rootValue,
          contextValue,
          variableValues,
          fragmentMatcher,
        }: ExecStoreQueryOptions) {
          // The result of executeStoreQuery can be safely cached only if the
          // underlying store is capable of tracking dependencies and invalidating
          // the cache when relevant data have changed.
          if (contextValue.store instanceof DepTrackingCache) {
            return reader.cacheKeyRoot.lookup(
              query,
              contextValue.store,
              fragmentMatcher,
              JSON.stringify(variableValues),
              rootValue.id,
            );
          }
          return;
        },
      },
    );

    this.executeSelectionSet = wrap(
      (options: ExecSelectionSetOptions) => {
        return executeSelectionSet.call(this, options);
      },
      {
        makeCacheKey({
          selectionSet,
          rootValue,
          execContext,
        }: ExecSelectionSetOptions) {
          if (execContext.contextValue.store instanceof DepTrackingCache) {
            return reader.cacheKeyRoot.lookup(
              selectionSet,
              execContext.contextValue.store,
              execContext.fragmentMatcher,
              JSON.stringify(execContext.variableValues),
              rootValue.id,
            );
          }
          return;
        },
      },
    );
  }

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
  public readQueryFromStore<QueryType>(options: ReadQueryOptions): QueryType {
    // Unless `true` is explicitly passed, add `false` here
    // to override `diffQueryAgainstStore`'s default of `true`.
    const optsPatch = { returnPartialData: false };

    if (options.returnPartialData) {
      optsPatch.returnPartialData = true;
    }

    return this.diffQueryAgainstStore<QueryType>({
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
  public diffQueryAgainstStore<T>({
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

    const execResult = this.executeStoreQuery({
      query,
      rootValue: {
        type: 'id',
        id: rootId,
        generated: true,
        typename: 'Query',
      },
      contextValue: context,
      variableValues: variables,
      fragmentMatcher: fragmentMatcherFunction,
    });

    const hasMissingFields =
      execResult.missing && execResult.missing.length > 0;

    if (hasMissingFields && !returnPartialData) {
      execResult.missing.forEach(info => {
        if (info.tolerable) return;
        throw new Error(
          `Can't find field ${info.fieldName} on object ${JSON.stringify(
            info.object,
            null,
            2,
          )}.`,
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

  /**
   * Based on graphql function from graphql-js:
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
  private executeStoreQuery({
    query,
    rootValue,
    contextValue,
    variableValues,
    // Default matcher always matches all fragments
    fragmentMatcher = defaultFragmentMatcher,
  }: ExecStoreQueryOptions): ExecResult {
    const mainDefinition = getMainDefinition(query);
    const fragments = getFragmentDefinitions(query);
    const fragmentMap = createFragmentMap(fragments);
    const execContext: ExecContext = {
      query,
      fragmentMap,
      contextValue,
      variableValues,
      fragmentMatcher,
    };

    return this.executeSelectionSet({
      selectionSet: mainDefinition.selectionSet,
      rootValue,
      execContext,
    });
  }

  private executeSelectionSet({
    selectionSet,
    rootValue,
    execContext,
  }: ExecSelectionSetOptions): ExecResult {
    const {
      fragmentMap,
      contextValue,
      variableValues: variables,
    } = execContext;
    const finalResult: ExecResult = {
      result: {},
    };

    const objectsToMerge: { [key: string]: any }[] = [];

    const object: StoreObject = contextValue.store.get(rootValue.id);

    const typename =
      (object && object.__typename) ||
      (rootValue.id === 'ROOT_QUERY' && 'Query') ||
      void 0;

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
        const fieldResult = handleMissing(
          this.executeField(object, typename, selection, execContext),
        );

        if (typeof fieldResult !== 'undefined') {
          objectsToMerge.push({
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

        const match = execContext.fragmentMatcher(
          rootValue,
          typeCondition,
          contextValue,
        );
        if (match) {
          let fragmentExecResult = this.executeSelectionSet({
            selectionSet: fragment.selectionSet,
            rootValue,
            execContext,
          });

          if (match === 'heuristic' && fragmentExecResult.missing) {
            fragmentExecResult = {
              ...fragmentExecResult,
              missing: fragmentExecResult.missing.map(info => {
                return { ...info, tolerable: true };
              }),
            };
          }

          objectsToMerge.push(handleMissing(fragmentExecResult));
        }
      }
    });

    // Perform a single merge at the end so that we can avoid making more
    // defensive shallow copies than necessary.
    merge(finalResult.result, objectsToMerge);

    return finalResult;
  }

  private executeField(
    object: StoreObject,
    typename: string | void,
    field: FieldNode,
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
      object,
      typename,
      fieldName,
      args,
      contextValue,
      info,
    );

    if (Array.isArray(readStoreResult.result)) {
      return this.combineExecResults(
        readStoreResult,
        this.executeSubSelectedArray(
          field,
          readStoreResult.result,
          execContext,
        ),
      );
    }

    // Handle all scalar types here
    if (!field.selectionSet) {
      assertSelectionSetForIdValue(field, readStoreResult.result);
      return readStoreResult;
    }

    // From here down, the field has a selection set, which means it's trying to
    // query a GraphQLObjectType
    if (readStoreResult.result == null) {
      // Basically any field in a GraphQL response can be null, or missing
      return readStoreResult;
    }

    // Returned value is an object, and the query has a sub-selection. Recurse.
    return this.combineExecResults(
      readStoreResult,
      this.executeSelectionSet({
        selectionSet: field.selectionSet,
        rootValue: readStoreResult.result,
        execContext,
      }),
    );
  }

  private combineExecResults<T>(
    ...execResults: ExecResult<T>[]
  ): ExecResult<T> {
    let missing: ExecResultMissingField[] = null;
    execResults.forEach(execResult => {
      if (execResult.missing) {
        missing = missing || [];
        missing.push(...execResult.missing);
      }
    });
    return {
      result: execResults.pop().result,
      missing,
    };
  }

  private executeSubSelectedArray(
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
        return handleMissing(
          this.executeSubSelectedArray(field, item, execContext),
        );
      }

      // This is an object, run the selection set on it
      if (field.selectionSet) {
        return handleMissing(
          this.executeSelectionSet({
            selectionSet: field.selectionSet,
            rootValue: item,
            execContext,
          }),
        );
      }

      assertSelectionSetForIdValue(field, item);

      return item;
    });

    return { result, missing };
  }
}

function assertSelectionSetForIdValue(field: FieldNode, value: any) {
  if (!field.selectionSet && isIdValue(value)) {
    throw new Error(
      `Missing selection set for object of type ${
        value.typename
      } returned for query field ${field.name.value}`,
    );
  }
}

function defaultFragmentMatcher() {
  return true;
}

export function assertIdValue(idValue: IdValue) {
  if (!isIdValue(idValue)) {
    throw new Error(`Encountered a sub-selection on the query, but the store doesn't have \
an object reference. This should never happen during normal use unless you have custom code \
that is directly manipulating the store; please file an issue.`);
  }
}

function readStoreResolver(
  object: StoreObject,
  typename: string | void,
  fieldName: string,
  args: any,
  context: ReadStoreContext,
  { resultKey, directives }: ExecInfo,
): ExecResult<StoreValue> {
  let storeKeyName = fieldName;
  if (args || directives) {
    // We happen to know here that getStoreKeyName returns its first
    // argument unmodified if there are no args or directives, so we can
    // avoid calling the function at all in that case, as a small but
    // important optimization to this frequently executed code.
    storeKeyName = getStoreKeyName(storeKeyName, args, directives);
  }

  let fieldValue: StoreValue | void = void 0;

  if (object) {
    fieldValue = object[storeKeyName];

    if (
      typeof fieldValue === 'undefined' &&
      context.cacheRedirects &&
      typeof typename === 'string'
    ) {
      // Look for the type in the custom resolver map
      const type = context.cacheRedirects[typename];
      if (type) {
        // Look for the field in the custom resolver map
        const resolver = type[fieldName];
        if (resolver) {
          fieldValue = resolver(object, args, {
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
      missing: [
        {
          object,
          fieldName: storeKeyName,
          tolerable: false,
        },
      ],
    };
  }

  if (isJsonValue(fieldValue)) {
    fieldValue = fieldValue.json;
  }

  return {
    result: fieldValue,
  };
}

const hasOwn = Object.prototype.hasOwnProperty;

function merge(
  target: { [key: string]: any },
  sources: { [key: string]: any }[],
) {
  const pastCopies: any[] = [];
  sources.forEach(source => {
    mergeHelper(target, source, pastCopies);
  });
  return target;
}

function mergeHelper(
  target: { [key: string]: any },
  source: { [key: string]: any },
  pastCopies: any[],
) {
  if (source !== null && typeof source === 'object') {
    // In case the target has been frozen, make an extensible copy so that
    // we can merge properties into the copy.
    if (Object.isExtensible && !Object.isExtensible(target)) {
      target = shallowCopyForMerge(target, pastCopies);
    }

    Object.keys(source).forEach(sourceKey => {
      const sourceValue = source[sourceKey];
      if (hasOwn.call(target, sourceKey)) {
        const targetValue = target[sourceKey];
        if (sourceValue !== targetValue) {
          // When there is a key collision, we need to make a shallow copy of
          // target[sourceKey] so the merge does not modify any source objects.
          // To avoid making unnecessary copies, we use a simple array to track
          // past copies, instead of a Map, since the number of copies should
          // be relatively small, and some Map polyfills modify their keys.
          target[sourceKey] = mergeHelper(
            shallowCopyForMerge(targetValue, pastCopies),
            sourceValue,
            pastCopies,
          );
        }
      } else {
        // If there is no collision, the target can safely share memory with
        // the source, and the recursion can terminate here.
        target[sourceKey] = sourceValue;
      }
    });
  }

  return target;
}

function shallowCopyForMerge<T>(value: T, pastCopies: any[]): T {
  if (
    value !== null &&
    typeof value === 'object' &&
    pastCopies.indexOf(value) < 0
  ) {
    if (Array.isArray(value)) {
      value = (value as any).slice(0);
    } else {
      value = { ...(value as any) };
    }
    pastCopies.push(value);
  }
  return value;
}
