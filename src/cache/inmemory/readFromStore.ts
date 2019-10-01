import {
  DocumentNode,
  FieldNode,
  FragmentDefinitionNode,
  InlineFragmentNode,
  SelectionSetNode,
} from 'graphql';
import { wrap, KeyTrie } from 'optimism';
import { InvariantError } from 'ts-invariant';

import {
  argumentsObjectFromField,
  isField,
  isInlineFragment,
  resultKeyNameFromField,
  StoreValue,
  Reference,
  isReference,
  makeReference,
} from '../../utilities/graphql/storeUtils';
import { canUseWeakMap } from '../../utilities/common/canUse';
import { createFragmentMap, FragmentMap } from '../../utilities/graphql/fragments';
import { shouldInclude } from '../../utilities/graphql/directives';
import {
  getDefaultValues,
  getFragmentDefinitions,
  getMainDefinition,
  getQueryDefinition,
} from '../../utilities/graphql/getFromAST';
import { isEqual } from '../../utilities/common/isEqual';
import { maybeDeepFreeze } from '../../utilities/common/maybeDeepFreeze';
import { mergeDeepArray } from '../../utilities/common/mergeDeep';
import { Cache } from '../core/types/Cache';
import {
  ReadStoreContext,
  DiffQueryAgainstStoreOptions,
  ReadQueryOptions,
  StoreObject,
  NormalizedCache,
} from './types';
import { supportsResultCaching } from './entityCache';
import { getTypenameFromStoreObject } from './helpers';
import { Policies } from './policies';

export type VariableMap = { [name: string]: any };

type ExecContext = {
  query: DocumentNode;
  fragmentMap: FragmentMap;
  contextValue: ReadStoreContext;
  variableValues: VariableMap;
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
  objectOrReference: StoreObject | Reference;
  contextValue: ReadStoreContext;
  variableValues: VariableMap;
};

type ExecSelectionSetOptions = {
  selectionSet: SelectionSetNode;
  objectOrReference: StoreObject | Reference;
  execContext: ExecContext;
};

type ExecSubSelectedArrayOptions = {
  field: FieldNode;
  array: any[];
  execContext: ExecContext;
};

export interface StoreReaderConfig {
  addTypename?: boolean;
  cacheKeyRoot?: KeyTrie<object>;
  policies: Policies;
}

export class StoreReader {
  constructor(private config: StoreReaderConfig) {
    const cacheKeyRoot =
      config && config.cacheKeyRoot || new KeyTrie<object>(canUseWeakMap);

    this.config = {
      addTypename: true,
      cacheKeyRoot,
      ...config,
    };

    const {
      executeStoreQuery,
      executeSelectionSet,
      executeSubSelectedArray,
    } = this;

    this.executeStoreQuery = wrap((options: ExecStoreQueryOptions) => {
      return executeStoreQuery.call(this, options);
    }, {
      makeCacheKey({
        query,
        objectOrReference,
        contextValue,
        variableValues,
      }: ExecStoreQueryOptions) {
        if (supportsResultCaching(contextValue.store)) {
          return cacheKeyRoot.lookup(
            contextValue.store,
            query,
            JSON.stringify(variableValues),
            isReference(objectOrReference) ? objectOrReference.__ref : objectOrReference,
          );
        }
      }
    });

    this.executeSelectionSet = wrap((options: ExecSelectionSetOptions) => {
      return executeSelectionSet.call(this, options);
    }, {
      makeCacheKey({
        selectionSet,
        objectOrReference,
        execContext,
      }: ExecSelectionSetOptions) {
        if (supportsResultCaching(execContext.contextValue.store)) {
          return cacheKeyRoot.lookup(
            execContext.contextValue.store,
            selectionSet,
            JSON.stringify(execContext.variableValues),
            isReference(objectOrReference) ? objectOrReference.__ref : objectOrReference,
          );
        }
      }
    });

    this.executeSubSelectedArray = wrap((options: ExecSubSelectedArrayOptions) => {
      return executeSubSelectedArray.call(this, options);
    }, {
      makeCacheKey({ field, array, execContext }) {
        if (supportsResultCaching(execContext.contextValue.store)) {
          return cacheKeyRoot.lookup(
            execContext.contextValue.store,
            field,
            array,
            JSON.stringify(execContext.variableValues),
          );
        }
      }
    });
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
  public readQueryFromStore<QueryType>(
    options: ReadQueryOptions,
  ): QueryType | undefined {
    return this.diffQueryAgainstStore<QueryType>({
      ...options,
      returnPartialData: false,
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
    config,
  }: DiffQueryAgainstStoreOptions): Cache.DiffResult<T> {
    // Throw the right validation error by trying to find a query in the document
    const queryDefinition = getQueryDefinition(query);

    variables = {
      ...getDefaultValues(queryDefinition),
      ...variables,
    };

    const context: ReadStoreContext = {
      // Global settings
      store,
      cacheRedirects: (config && config.cacheRedirects) || {},
      policies: this.config.policies,
    };

    const execResult = this.executeStoreQuery({
      query,
      objectOrReference: rootId === 'ROOT_QUERY'
        ? makeReference('ROOT_QUERY')
        : store.get(rootId) || makeReference(rootId),
      contextValue: context,
      variableValues: variables,
    });

    const hasMissingFields =
      execResult.missing && execResult.missing.length > 0;

    if (hasMissingFields && ! returnPartialData) {
      execResult.missing!.forEach(info => {
        if (info.tolerable) return;
        throw new InvariantError(
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
   */
  private executeStoreQuery({
    query,
    objectOrReference,
    contextValue,
    variableValues,
  }: ExecStoreQueryOptions): ExecResult {
    const mainDefinition = getMainDefinition(query);
    const fragments = getFragmentDefinitions(query);
    const fragmentMap = createFragmentMap(fragments);
    const execContext: ExecContext = {
      query,
      fragmentMap,
      contextValue,
      variableValues,
    };

    return this.executeSelectionSet({
      selectionSet: mainDefinition.selectionSet,
      objectOrReference,
      execContext,
    });
  }

  private executeSelectionSet({
    selectionSet,
    objectOrReference,
    execContext,
  }: ExecSelectionSetOptions): ExecResult {
    const { fragmentMap, variableValues: variables } = execContext;
    const finalResult: ExecResult = { result: null };
    const objectsToMerge: { [key: string]: any }[] = [];

    let object: StoreObject;
    let typename: string;
    if (isReference(objectOrReference)) {
      object = execContext.contextValue.store.get(objectOrReference.__ref);
      typename =
        (object && object.__typename) ||
        (objectOrReference.__ref === 'ROOT_QUERY' && 'Query');
    } else {
      object = objectOrReference;
      typename = object && object.__typename;
    }

    if (this.config.addTypename) {
      const typenameFromStore = object && object.__typename;
      if (typeof typenameFromStore === 'string') {
        // Ensure we always include a default value for the __typename field,
        // if we have one, and this.config.addTypename is true. Note that this
        // field can be overridden by other merged objects.
        objectsToMerge.push({ __typename: typenameFromStore });
      }
    }

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
            throw new InvariantError(`No fragment named ${selection.name.value}`);
          }
        }

        const match = this.config.policies.fragmentMatches(fragment, typename);
        if (match && (object || typename === 'Query')) {
          let fragmentExecResult = this.executeSelectionSet({
            selectionSet: fragment.selectionSet,
            objectOrReference: object,
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
    finalResult.result = mergeDeepArray(objectsToMerge);

    if (process.env.NODE_ENV !== 'production') {
      Object.freeze(finalResult.result);
    }

    return finalResult;
  }

  private executeField(
    object: StoreObject,
    typename: string | undefined,
    field: FieldNode,
    execContext: ExecContext,
  ): ExecResult {
    const {
      variableValues: variables,
      contextValue: {
        store,
        cacheRedirects,
        policies,
      },
    } = execContext;

    const storeFieldName = policies.getStoreFieldName(
      typename,
      field,
      variables,
    );

    let fieldValue: StoreValue | undefined;

    if (object) {
      fieldValue = object[storeFieldName];

      if (
        typeof fieldValue === "undefined" &&
        cacheRedirects &&
        typeof typename === "string"
      ) {
        // Look for the type in the custom resolver map
        const type = cacheRedirects[typename];
        if (type) {
          // Look for the field in the custom resolver map
          const resolver = type[field.name.value];
          if (resolver) {
            const args = argumentsObjectFromField(field, variables);
            fieldValue = resolver(object, args, {
              getCacheKey(storeObj: StoreObject) {
                const id = policies.identify(storeObj);
                return id && makeReference(id);
              },
            });
          }
        }
      }
    }

    const readStoreResult = typeof fieldValue === "undefined" ? {
      result: fieldValue,
      missing: [{
        object,
        fieldName: storeFieldName,
        tolerable: false,
      }],
    } : {
      result: fieldValue,
    };

    if (Array.isArray(readStoreResult.result)) {
      return this.combineExecResults(
        readStoreResult,
        this.executeSubSelectedArray({
          field,
          array: readStoreResult.result,
          execContext,
        }),
      );
    }

    // Handle all scalar types here
    if (!field.selectionSet) {
      if (process.env.NODE_ENV !== 'production') {
        assertSelectionSetForIdValue(store, field, readStoreResult.result);
        maybeDeepFreeze(readStoreResult);
      }
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
        objectOrReference: readStoreResult.result as StoreObject | Reference,
        execContext,
      }),
    );
  }

  private combineExecResults<T>(
    ...execResults: ExecResult<T>[]
  ): ExecResult<T> {
    let missing: ExecResultMissingField[] | undefined;
    execResults.forEach(execResult => {
      if (execResult.missing) {
        missing = missing || [];
        missing.push(...execResult.missing);
      }
    });
    return {
      result: execResults.pop()!.result,
      missing,
    };
  }

  private executeSubSelectedArray({
    field,
    array,
    execContext,
  }: ExecSubSelectedArrayOptions): ExecResult {
    let missing: ExecResultMissingField[] | undefined;

    function handleMissing<T>(childResult: ExecResult<T>): T {
      if (childResult.missing) {
        missing = missing || [];
        missing.push(...childResult.missing);
      }

      return childResult.result;
    }

    array = array.map(item => {
      // null value in array
      if (item === null) {
        return null;
      }

      // This is a nested array, recurse
      if (Array.isArray(item)) {
        return handleMissing(this.executeSubSelectedArray({
          field,
          array: item,
          execContext,
        }));
      }

      // This is an object, run the selection set on it
      if (field.selectionSet) {
        return handleMissing(this.executeSelectionSet({
          selectionSet: field.selectionSet,
          objectOrReference: item,
          execContext,
        }));
      }

      if (process.env.NODE_ENV !== 'production') {
        assertSelectionSetForIdValue(execContext.contextValue.store, field, item);
      }

      return item;
    });

    if (process.env.NODE_ENV !== 'production') {
      Object.freeze(array);
    }

    return { result: array, missing };
  }
}

function assertSelectionSetForIdValue(
  store: NormalizedCache,
  field: FieldNode,
  fieldValue: any,
) {
  if (!field.selectionSet) {
    const workSet = new Set([fieldValue]);
    workSet.forEach(value => {
      if (value && typeof value === "object") {
        if (isReference(value)) {
          throw new InvariantError(
            `Missing selection set for object of type ${
              getTypenameFromStoreObject(store, value)
            } returned for query field ${field.name.value}`,
          )
        }
        Object.values(value).forEach(workSet.add, workSet);
      }
    });
  }
}
