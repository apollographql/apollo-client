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
  DiffQueryAgainstStoreOptions,
  ReadQueryOptions,
  StoreObject,
  NormalizedCache,
  CacheResolverMap,
} from './types';
import { supportsResultCaching } from './entityCache';
import { getTypenameFromStoreObject } from './helpers';
import { Policies } from './policies';

export type VariableMap = { [name: string]: any };

interface ExecContext {
  query: DocumentNode;
  store: NormalizedCache;
  policies: Policies;
  fragmentMap: FragmentMap;
  variables: VariableMap;
  cacheRedirects: CacheResolverMap;
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

type ExecSelectionSetOptions = {
  selectionSet: SelectionSetNode;
  objectOrReference: StoreObject | Reference;
  context: ExecContext;
};

type ExecSubSelectedArrayOptions = {
  field: FieldNode;
  array: any[];
  context: ExecContext;
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
      executeSelectionSet,
      executeSubSelectedArray,
    } = this;

    this.executeSelectionSet = wrap((options: ExecSelectionSetOptions) => {
      return executeSelectionSet.call(this, options);
    }, {
      makeCacheKey({
        selectionSet,
        objectOrReference,
        context,
      }: ExecSelectionSetOptions) {
        if (supportsResultCaching(context.store)) {
          return cacheKeyRoot.lookup(
            context.store,
            selectionSet,
            JSON.stringify(context.variables),
            isReference(objectOrReference) ? objectOrReference.__ref : objectOrReference,
          );
        }
      }
    });

    this.executeSubSelectedArray = wrap((options: ExecSubSelectedArrayOptions) => {
      return executeSubSelectedArray.call(this, options);
    }, {
      makeCacheKey({ field, array, context }) {
        if (supportsResultCaching(context.store)) {
          return cacheKeyRoot.lookup(
            context.store,
            field,
            array,
            JSON.stringify(context.variables),
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
    const execResult = this.executeSelectionSet({
      selectionSet: getMainDefinition(query).selectionSet,
      objectOrReference: rootId === 'ROOT_QUERY'
        ? makeReference('ROOT_QUERY')
        : store.get(rootId) || makeReference(rootId),
      context: {
        store,
        query,
        policies: this.config.policies,
        variables: {
          ...getDefaultValues(getQueryDefinition(query)),
          ...variables,
        },
        fragmentMap: createFragmentMap(getFragmentDefinitions(query)),
        cacheRedirects: config && config.cacheRedirects || {},
      },
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

  private executeSelectionSet({
    selectionSet,
    objectOrReference,
    context,
  }: ExecSelectionSetOptions): ExecResult {
    const { fragmentMap, variables: variables } = context;
    const finalResult: ExecResult = { result: null };
    const objectsToMerge: { [key: string]: any }[] = [];

    let object: StoreObject;
    let typename: string;
    if (isReference(objectOrReference)) {
      object = context.store.get(objectOrReference.__ref);
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
          this.executeField(object, typename, selection, context),
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
            context,
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
    context: ExecContext,
  ): ExecResult {
    const {
      variables: variables,
      store,
      cacheRedirects,
      policies,
    } = context;

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
          context,
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
        context,
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
    context,
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
          context,
        }));
      }

      // This is an object, run the selection set on it
      if (field.selectionSet) {
        return handleMissing(this.executeSelectionSet({
          selectionSet: field.selectionSet,
          objectOrReference: item,
          context,
        }));
      }

      if (process.env.NODE_ENV !== 'production') {
        assertSelectionSetForIdValue(context.store, field, item);
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
