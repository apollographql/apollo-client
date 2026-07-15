import type { DocumentNode, FieldNode, SelectionSetNode } from "graphql";
import { Kind } from "graphql";
import type { OptimisticWrapperFunction } from "optimism";
import { wrap } from "optimism";

import type { Reference, StoreObject } from "@apollo/client/utilities";
import {
  addTypenameToDocument,
  cacheSizes,
  canonicalStringify,
  isReference,
} from "@apollo/client/utilities";
import { __DEV__ } from "@apollo/client/utilities/environment";
import type {
  FragmentMap,
  FragmentMapFunction,
} from "@apollo/client/utilities/internal";
import {
  DeepMerger,
  getDefaultValues,
  getFragmentFromSelection,
  getMainDefinition,
  getQueryDefinition,
  handleIncrementalSymbol,
  isArray,
  isDeferredFragment,
  isField,
  isNonNullObject,
  makeReference,
  maybeDeepFreeze,
  mergeDeepArray,
  resultKeyNameFromField,
  shouldInclude,
} from "@apollo/client/utilities/internal";
import {
  invariant,
  newInvariantError,
} from "@apollo/client/utilities/invariant";

import { defaultCacheSizes } from "../../utilities/caching/sizes.js";
import type { Cache } from "../core/types/Cache.js";
import type { MissingTree } from "../core/types/common.js";
import { MissingFieldError } from "../core/types/common.js";

import {
  maybeDependOnExistenceOfEntity,
  supportsResultCaching,
} from "./entityStore.js";
import {
  extractFragmentContext,
  getTypenameFromStoreObject,
} from "./helpers.js";
import type { InMemoryCache } from "./inMemoryCache.js";
import type { Policies } from "./policies.js";
import type {
  DiffQueryAgainstStoreOptions,
  InMemoryCacheConfig,
  NormalizedCache,
  ReadMergeModifyContext,
} from "./types.js";

type DataState = "empty" | "partial" | "streaming" | "complete";

interface ReadContext extends ReadMergeModifyContext {
  query: DocumentNode;
  policies: Policies;
  fragmentMap: FragmentMap;
  lookupFragment: FragmentMapFunction;
}

type ExecResult<R = any> = {
  result: R;
  dataState: DataState;
  missing?: MissingTree;
};

type ExecSelectionSetOptions = {
  selectionSet: SelectionSetNode;
  objectOrReference: StoreObject | Reference;
  enclosingRef: Reference;
  context: ReadContext;
  [handleIncrementalSymbol]: true | undefined;
};

type ExecSubSelectedArrayOptions = {
  field: FieldNode;
  array: readonly any[];
  enclosingRef: Reference;
  context: ReadContext;
  [handleIncrementalSymbol]: true | undefined;
};

interface StoreReaderConfig {
  cache: InMemoryCache;
  fragments?: InMemoryCacheConfig["fragments"];
}

// Arguments type after keyArgs translation.
type ExecSelectionSetKeyArgs = [
  SelectionSetNode,
  StoreObject | Reference,
  ReadMergeModifyContext,
];

function execSelectionSetKeyArgs(
  options: ExecSelectionSetOptions
): ExecSelectionSetKeyArgs {
  return [options.selectionSet, options.objectOrReference, options.context];
}

export class StoreReader {
  // cached version of executeSelectionSet
  private executeSelectionSet: OptimisticWrapperFunction<
    [ExecSelectionSetOptions], // Actual arguments tuple type.
    ExecResult, // Actual return type.
    ExecSelectionSetKeyArgs
  >;

  // cached version of executeSubSelectedArray
  private executeSubSelectedArray: OptimisticWrapperFunction<
    [ExecSubSelectedArrayOptions],
    ExecResult<any>,
    [ExecSubSelectedArrayOptions]
  >;

  private config: {
    cache: InMemoryCache;
    fragments?: InMemoryCacheConfig["fragments"];
  };

  private knownResults = new WeakMap<Record<string, any>, SelectionSetNode>();

  constructor(config: StoreReaderConfig) {
    this.config = config;

    // memoized functions in this class will be "garbage-collected"
    // by recreating the whole `StoreReader` in
    // `InMemoryCache.resetResultsCache`
    // (triggered from `InMemoryCache.gc` with `resetResultCache: true`)
    this.executeSelectionSet = wrap(
      (options) => {
        const peekArgs = execSelectionSetKeyArgs(options);

        const other = this.executeSelectionSet.peek(...peekArgs);

        if (other) {
          // If we previously read this result with canonization enabled, we can
          // return that canonized result as-is.
          return other;
        }

        maybeDependOnExistenceOfEntity(
          options.context.store,
          options.enclosingRef.__ref
        );

        // Finally, if we didn't find any useful previous results, run the real
        // execSelectionSetImpl method with the given options.
        return this.execSelectionSetImpl(options);
      },
      {
        max:
          cacheSizes["inMemoryCache.executeSelectionSet"] ||
          defaultCacheSizes["inMemoryCache.executeSelectionSet"],
        keyArgs: execSelectionSetKeyArgs,
        // Note that the parameters of makeCacheKey are determined by the
        // array returned by keyArgs.
        makeCacheKey(selectionSet, parent, context) {
          if (supportsResultCaching(context.store)) {
            return context.store.makeCacheKey(
              selectionSet,
              isReference(parent) ? parent.__ref : parent,
              context.varString,
              context.returnPartialData
            );
          }
        },
      }
    );

    this.executeSubSelectedArray = wrap(
      (options: ExecSubSelectedArrayOptions) => {
        maybeDependOnExistenceOfEntity(
          options.context.store,
          options.enclosingRef.__ref
        );
        return this.execSubSelectedArrayImpl(options);
      },
      {
        max:
          cacheSizes["inMemoryCache.executeSubSelectedArray"] ||
          defaultCacheSizes["inMemoryCache.executeSubSelectedArray"],
        makeCacheKey({ field, array, context }) {
          if (supportsResultCaching(context.store)) {
            return context.store.makeCacheKey(
              field,
              array,
              context.varString,
              context.returnPartialData
            );
          }
        },
      }
    );
  }

  /**
   * Given a store and a query, return as much of the result as possible and
   * identify if any data was missing from the store.
   */
  public diffQueryAgainstStore<T>(
    options: DiffQueryAgainstStoreOptions & {
      [handleIncrementalSymbol]: true;
    }
  ): Cache.InternalDiffResultWithDataState<T>;

  public diffQueryAgainstStore<T>(
    options: DiffQueryAgainstStoreOptions
  ): Cache.DiffResult<T>;

  public diffQueryAgainstStore<T>({
    store,
    query,
    rootId = "ROOT_QUERY",
    variables,
    returnPartialData = true,
    [handleIncrementalSymbol]: handleIncremental,
  }: DiffQueryAgainstStoreOptions): Cache.DiffResult<T> & {
    dataState?: "empty" | "partial" | "streaming" | "complete";
  } {
    const policies = this.config.cache.policies;

    variables = {
      ...getDefaultValues(getQueryDefinition(query)),
      ...variables!,
    };

    const rootRef = makeReference(rootId);
    const execResult = this.executeSelectionSet({
      selectionSet: getMainDefinition(query).selectionSet,
      objectOrReference: rootRef,
      enclosingRef: rootRef,
      context: {
        store,
        query,
        policies,
        variables,
        varString: canonicalStringify(variables),
        returnPartialData,
        ...extractFragmentContext(query, this.config.fragments),
      },
      [handleIncrementalSymbol]: handleIncremental,
    });

    let missing: MissingFieldError | undefined;
    if (execResult.missing) {
      missing = new MissingFieldError(
        firstMissing(execResult.missing)!,
        execResult.missing,
        query,
        variables
      );
    }

    const { result, dataState } = execResult;

    const diffResult = {
      result:
        (
          result === undefined ||
          (Object.keys(result).length === 0 && dataState !== "complete")
        ) ?
          null
        : result,
      complete: dataState === "complete",
      missing,
    } as Cache.DiffResult<T>;

    if (handleIncremental) {
      (diffResult as Cache.InternalDiffResultWithDataState<T>).dataState =
        dataState;
    }

    return diffResult;
  }

  public isFresh(
    result: Record<string, any>,
    parent: StoreObject | Reference,
    selectionSet: SelectionSetNode,
    context: ReadMergeModifyContext
  ): boolean {
    if (
      supportsResultCaching(context.store) &&
      this.knownResults.get(result) === selectionSet
    ) {
      const latest = this.executeSelectionSet.peek(
        selectionSet,
        parent,
        context
      );
      if (latest && result === latest.result) {
        return true;
      }
    }
    return false;
  }

  // Uncached version of executeSelectionSet.
  private execSelectionSetImpl({
    selectionSet,
    objectOrReference,
    enclosingRef,
    context,
    [handleIncrementalSymbol]: handleIncremental,
  }: ExecSelectionSetOptions): ExecResult {
    if (
      isReference(objectOrReference) &&
      !context.policies.rootTypenamesById[objectOrReference.__ref] &&
      !context.store.has(objectOrReference.__ref)
    ) {
      return {
        result: {},
        dataState: "empty",
        missing: `Dangling reference to missing ${objectOrReference.__ref} object`,
      };
    }

    const { variables, policies, store } = context;
    const typename = store.getFieldValue<string>(
      objectOrReference,
      "__typename"
    );

    const objectsToMerge: Record<string, any>[] = [];
    let dataState: DataState | undefined;
    let missing: MissingTree | undefined;
    const missingMerger = new DeepMerger();

    if (typeof typename === "string" && !policies.rootIdsByTypename[typename]) {
      // Ensure we always include a default value for the __typename
      // field, if we have one. Note that this field can be overridden by other
      // merged objects.
      objectsToMerge.push({ __typename: typename });
    }

    function handleMissing<T>(result: ExecResult<T>, resultName: string): T {
      if (result.missing) {
        missing = missingMerger.merge(missing, {
          [resultName]: result.missing,
        });
      }
      return result.result;
    }

    for (const selection of selectionSet.selections) {
      // Omit fields with directives @skip(if: <truthy value>) or
      // @include(if: <falsy value>).
      if (!shouldInclude(selection, variables)) {
        if (!dataState) {
          dataState = "complete";
        }

        continue;
      }

      if (isField(selection)) {
        let fieldValue = policies.readField(
          {
            fieldName: selection.name.value,
            field: selection,
            variables: context.variables,
            from: objectOrReference,
          },
          context
        );

        const resultName = resultKeyNameFromField(selection);

        if (fieldValue === void 0) {
          if (!addTypenameToDocument.added(selection)) {
            missing = missingMerger.merge(missing, {
              [resultName]: `Can't find field '${selection.name.value}' on ${
                isReference(objectOrReference) ?
                  objectOrReference.__ref + " object"
                : "object " + JSON.stringify(objectOrReference, null, 2)
              }`,
            });

            dataState = dataState === undefined ? "empty" : "partial";
          }
        } else if (isArray(fieldValue)) {
          if (fieldValue.length > 0) {
            const execResult = this.executeSubSelectedArray({
              field: selection,
              array: fieldValue,
              enclosingRef,
              context,
              [handleIncrementalSymbol]: handleIncremental,
            });

            handleMissing(execResult, resultName);

            fieldValue = execResult.result;

            if (!dataState) {
              dataState = execResult.dataState;
            }

            if (dataState !== execResult.dataState) {
              dataState =
                (
                  (dataState === "complete" || dataState === "streaming") &&
                  (execResult.dataState === "complete" ||
                    execResult.dataState === "streaming")
                ) ?
                  "streaming"
                : "partial";
            }
          } else if (!dataState) {
            // empty arrays are considered complete
            dataState = "complete";
          }
        } else if (!selection.selectionSet) {
          dataState =
            dataState === "empty" ? "partial" : dataState || "complete";
        } else if (fieldValue != null) {
          if (__DEV__) {
            const fieldName = selection.name.value;

            if (typename) {
              const policy = policies["getFieldPolicy"](typename, fieldName);

              if (policy?.scalar) {
                invariant.warn(
                  "The field policy for '%s' is configured as a '%s' scalar, but the field is not a scalar field because it contains a selection set. The field value remains unchanged.",
                  `${typename}.${fieldName}`,
                  policy.scalar
                );
              }
            }
          }
          // In this case, because we know the field has a selection set,
          // it must be trying to query a GraphQLObjectType, which is why
          // fieldValue must be != null.
          const execResult = this.executeSelectionSet({
            selectionSet: selection.selectionSet,
            objectOrReference: fieldValue as StoreObject | Reference,
            enclosingRef: isReference(fieldValue) ? fieldValue : enclosingRef,
            context,
            [handleIncrementalSymbol]: handleIncremental,
          });

          handleMissing(execResult, resultName);

          fieldValue = execResult.result;

          if (!dataState) {
            dataState = execResult.dataState;
          }

          if (dataState !== execResult.dataState) {
            if (dataState === "empty") {
              dataState = "partial";
            } else if (dataState === "streaming") {
              dataState =
                execResult.dataState === "complete" ? "streaming" : "partial";
            } else if (dataState === "complete") {
              dataState =
                execResult.dataState === "streaming" ? "streaming" : "partial";
            }
          }
        }

        if (fieldValue !== void 0) {
          objectsToMerge.push({ [resultName]: fieldValue });
        }
      } else {
        const fragment = getFragmentFromSelection(
          selection,
          context.lookupFragment
        );

        if (!fragment && selection.kind === Kind.FRAGMENT_SPREAD) {
          throw newInvariantError(`No fragment named %s`, selection.name.value);
        }

        if (fragment && policies.fragmentMatches(fragment, typename)) {
          const isDeferBoundary = isDeferredFragment(
            selection,
            context.variables
          );
          let execResult = this.executeSelectionSet({
            selectionSet: fragment.selectionSet,
            objectOrReference,
            enclosingRef,
            context,
            [handleIncrementalSymbol]: handleIncremental,
          });

          // If the defer boundary has no data yet, we don't consider its
          // fields "missing" so we reset its missing value to undefined.
          if (isDeferBoundary && execResult.dataState === "empty") {
            execResult = maybeDeepFreeze({ ...execResult, missing: undefined });
          }

          if (execResult.result !== void 0) {
            objectsToMerge.push(execResult.result);
          }

          if (execResult.missing) {
            missing = missingMerger.merge(missing, execResult.missing);
          }

          if (!dataState) {
            // An unresolved defer boundary is not "missing" data because the
            // object is waiting for its deferred fields to stream in. Initiate
            // with "streaming" so any data we have (such as `__typename`) is
            // surfaced instead of discarded as "empty".
            dataState =
              isDeferBoundary && execResult.dataState === "empty" ?
                "streaming"
              : execResult.dataState;
          }

          if (handleIncremental && dataState !== execResult.dataState) {
            if (dataState === "empty") {
              dataState = "partial";
            } else if (dataState === "streaming") {
              dataState =
                (
                  execResult.dataState === "complete" ||
                  (isDeferBoundary && execResult.dataState === "empty")
                ) ?
                  "streaming"
                : "partial";
            } else if (dataState === "complete") {
              dataState =
                (
                  execResult.dataState === "streaming" ||
                  (isDeferBoundary && execResult.dataState === "empty")
                ) ?
                  "streaming"
                : "partial";
            }
          }
        }
      }
    }

    if (
      dataState === undefined ||
      (dataState === "partial" && !context.returnPartialData)
    ) {
      dataState = "empty";
    }

    // Even when the selection set is "empty" (none of the explicitly selected
    // fields are present), the object may still carry data merged from the
    // store, such as the implicitly included `__typename`. When we opt into
    // partial data we surface that object instead of discarding it.
    // The `dataState` is intentionally left as "empty" so an enclosing defer
    // boundary can still recognize it as unresolved.
    const result =
      (
        dataState !== "empty" ||
        (context.returnPartialData && objectsToMerge.length > 0)
      ) ?
        mergeDeepArray(objectsToMerge)
      : undefined;

    const finalResult: ExecResult = { result, missing, dataState };
    const frozen = maybeDeepFreeze(finalResult);

    // Store this result with its selection set so that we can quickly
    // recognize it again in the StoreReader#isFresh method.
    if (frozen.result) {
      this.knownResults.set(frozen.result, selectionSet);
    }

    return frozen;
  }

  // Uncached version of executeSubSelectedArray.
  private execSubSelectedArrayImpl({
    field,
    array,
    enclosingRef,
    context,
    [handleIncrementalSymbol]: handleIncremental,
  }: ExecSubSelectedArrayOptions): ExecResult {
    let dataState: DataState = "complete";
    let missing: MissingTree | undefined;
    let missingMerger = new DeepMerger();

    function handleMissing<T>(childResult: ExecResult<T>, i: number): T {
      if (childResult.missing) {
        missing = missingMerger.merge(missing, { [i]: childResult.missing });
      }
      return childResult.result;
    }

    if (field.selectionSet) {
      array = array.filter(
        (item) => item === undefined || context.store.canRead(item)
      );
    }

    array = array.map((item, i) => {
      // null value in array
      if (item === null) {
        return null;
      }

      // This is a nested array, recurse
      if (isArray(item)) {
        const execResult = this.executeSubSelectedArray({
          field,
          array: item,
          enclosingRef,
          context,
          [handleIncrementalSymbol]: handleIncremental,
        });

        if (dataState !== execResult.dataState) {
          dataState =
            (
              (dataState === "complete" || dataState === "streaming") &&
              (execResult.dataState === "streaming" ||
                execResult.dataState === "complete")
            ) ?
              "streaming"
            : "partial";
        }

        return handleMissing(execResult, i);
      }

      // This is an object, run the selection set on it
      if (field.selectionSet) {
        const execResult = this.executeSelectionSet({
          selectionSet: field.selectionSet,
          objectOrReference: item,
          enclosingRef: isReference(item) ? item : enclosingRef,
          context,
          [handleIncrementalSymbol]: handleIncremental,
        });

        if (dataState !== execResult.dataState) {
          dataState =
            (
              (dataState === "complete" || dataState === "streaming") &&
              (execResult.dataState === "streaming" ||
                execResult.dataState === "complete")
            ) ?
              "streaming"
            : "partial";
        }

        return handleMissing(execResult, i);
      }

      if (__DEV__) {
        assertSelectionSetForIdValue(context.store, field, item);
      }

      return item;
    });

    return {
      result: array,
      dataState,
      missing,
    };
  }
}

function firstMissing(tree: MissingTree): string | undefined {
  try {
    JSON.stringify(tree, (_, value) => {
      if (typeof value === "string") throw value;
      return value;
    });
  } catch (result) {
    return result as string;
  }
}

function assertSelectionSetForIdValue(
  store: NormalizedCache,
  field: FieldNode,
  fieldValue: any
) {
  if (!field.selectionSet) {
    const workSet = new Set([fieldValue]);
    workSet.forEach((value) => {
      if (isNonNullObject(value)) {
        invariant(
          !isReference(value),
          `Missing selection set for object of type %s returned for query field %s`,
          getTypenameFromStoreObject(store, value),
          field.name.value
        );
        Object.values(value).forEach(workSet.add, workSet);
      }
    });
  }
}
