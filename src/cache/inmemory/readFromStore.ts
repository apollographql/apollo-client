import type {
  DocumentNode,
  FieldNode,
  SelectionNode,
  SelectionSetNode,
} from "graphql";
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
  FieldMap,
  FragmentMap,
  FragmentMapFunction,
} from "@apollo/client/utilities/internal";
import {
  collectSiblingFields,
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

type DataState =
  // no data
  | "empty"
  // at least 1 non-deferred field is partial
  | "partial"
  // at least 1 defer boundary is partial. All non-deferred fields complete
  | "deferPartial"
  // All defer boundaries are complete or empty (but not partial)
  | "streaming"
  // All fields have data
  | "complete";

interface ReadContext extends ReadMergeModifyContext {
  query: DocumentNode;
  policies: Policies;
  fragmentMap: FragmentMap;
  lookupFragment: FragmentMapFunction;
}

type DeferBoundaryResultsMap = Map<
  Exclude<SelectionNode, { kind: "Field" }>,
  ExecResult
>;

type ExecResult<R = any> = {
  result: R;
  dataState: DataState;
  deferBoundaryResults?: DeferBoundaryResultsMap;
  missing?: MissingTree;
};

type ExecSelectionSetOptions = {
  selectionSet: SelectionSetNode;
  objectOrReference: StoreObject | Reference;
  enclosingRef: Reference;
  context: ReadContext;
};

type ExecSubSelectedArrayOptions = {
  field: FieldNode;
  array: readonly any[];
  enclosingRef: Reference;
  context: ReadContext;
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
              context.varString
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
            return context.store.makeCacheKey(field, array, context.varString);
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
    const fragmentContext = extractFragmentContext(
      query,
      this.config.fragments
    );
    let execResult = this.executeSelectionSet({
      selectionSet: getMainDefinition(query).selectionSet,
      objectOrReference: rootRef,
      enclosingRef: rootRef,
      context: {
        store,
        query,
        policies,
        variables,
        varString: canonicalStringify(variables),
        ...fragmentContext,
      },
    });

    if (
      handleIncremental &&
      !returnPartialData &&
      execResult.dataState === "deferPartial"
    ) {
      execResult = maybeStripPartialDeferredFragments(
        query,
        execResult,
        fragmentContext.fragmentMap
      );
    }

    let missing: MissingFieldError | undefined;
    if (
      execResult.missing &&
      // Ignore reporting missing if we ask for an incremental result and the
      // only missing fields are at defer boundaries
      (!handleIncremental || execResult.dataState !== "streaming")
    ) {
      missing = new MissingFieldError(
        firstMissing(execResult.missing)!,
        execResult.missing,
        query,
        variables
      );
    }

    let { result, dataState } = execResult;

    if (
      // If maybeStripPartialDeferredFragments didn't reassign dataState to
      // streaming, deferPartial is treated the same as partial since it means
      // one of the defer boundaries is partial
      dataState === "deferPartial" ||
      // When we don't tolerate incremental responses, streaming becomes the
      // same as partial since at least one defer boundary has missing data.
      (dataState === "streaming" && !handleIncremental)
    ) {
      dataState = "partial";
    }

    if (dataState === "partial" && !returnPartialData) {
      dataState = "empty";
    }

    const complete = dataState === "complete";

    const diffResult = {
      result:
        complete || dataState === "streaming" ? result
        : returnPartialData ?
          Object.keys(result).length === 0 ?
            null
          : result
        : null,
      complete,
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

    // We can't make executeSelectionSet aware of returnPartialData because of
    // the isFresh method that uses this method's cached result. Using
    // returnPartialData for this method means it would have to be part of this
    // method's cache key since returnPartialData affects the returned result,
    // but writeToStore has no way to reliably get a returnPartialData value
    // (there is no returnPartialData option when writing to the cache).
    //
    // Not having returnPartialData becomes a problem for partial data written
    // inside defer boundaries. When returnPartialData is false, we want to keep
    // all non-deferred fields, but strip any partial data inside the defer
    // boundary. This has to happen in diffQueryAgainstStore since it is aware
    // of returnPartialData, but to avoid having to traverse the whole object
    // again, we use this map to store the result of a fragment with its result.
    // This makes it cheaper to determine when we need to actually iterate on
    // the returned object to remove partial data from a defer boundary.
    const deferBoundaryResults: DeferBoundaryResultsMap = new Map();

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
        // A skipped field is considered complete, but it should only count
        // toward the data state if we haven't processed any other fields yet.
        // This ensures we report a complete result even if all fields inside
        // the selection set are skipped
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
            });

            handleMissing(execResult, resultName);

            fieldValue = execResult.result;

            dataState = transitionTo(dataState, execResult.dataState);

            // Copy over any inner defer boundary results so that the top-most
            // execResult contains a flat map of results
            execResult.deferBoundaryResults?.forEach(
              (innerExecResult, innerSelection) =>
                deferBoundaryResults.set(innerSelection, innerExecResult)
            );
          } else {
            // empty arrays are considered complete
            dataState = transitionTo(dataState, "complete");
          }
        } else if (!selection.selectionSet) {
          dataState = transitionTo(dataState, "complete");
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
          });

          handleMissing(execResult, resultName);

          fieldValue = execResult.result;
          dataState = transitionTo(dataState, execResult.dataState);

          // Copy over any inner defer boundary results so that the top-most
          // execResult contains a flat map of results
          execResult.deferBoundaryResults?.forEach(
            (innerExecResult, innerSelection) =>
              deferBoundaryResults.set(innerSelection, innerExecResult)
          );
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
          });
          let newDataState = execResult.dataState;

          if (isDeferBoundary) {
            deferBoundaryResults.set(selection, execResult);

            if (newDataState === "empty") {
              newDataState = "streaming";
            } else if (newDataState === "partial") {
              newDataState = "deferPartial";
            }
          }

          // Copy over any inner defer boundary results so that the top-most
          // execResult contains a flat map of results
          execResult.deferBoundaryResults?.forEach(
            (innerExecResult, innerSelection) =>
              deferBoundaryResults.set(innerSelection, innerExecResult)
          );

          if (execResult.result !== void 0) {
            objectsToMerge.push(execResult.result);
          }

          if (execResult.missing) {
            missing = missingMerger.merge(missing, execResult.missing);
          }

          dataState = transitionTo(dataState, newDataState);
        }
      }
    }

    dataState ||= "empty";

    const result = mergeDeepArray(objectsToMerge);

    const finalResult: ExecResult = {
      result,
      missing,
      dataState,
      deferBoundaryResults,
    };
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
        });

        dataState = transitionTo(dataState, execResult.dataState);

        return handleMissing(execResult, i);
      }

      // This is an object, run the selection set on it
      if (field.selectionSet) {
        const execResult = this.executeSelectionSet({
          selectionSet: field.selectionSet,
          objectOrReference: item,
          enclosingRef: isReference(item) ? item : enclosingRef,
          context,
        });

        dataState = transitionTo(dataState, execResult.dataState);

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

function maybeStripPartialDeferredFragments<T>(
  document: DocumentNode,
  execResult: ExecResult<T>,
  fragmentMap: FragmentMap
): ExecResult<T> {
  if (!execResult.deferBoundaryResults) return execResult;

  // We only need to process partial fragments in this function. If all
  // fragments are either complete or streaming, we don't need to process
  // anything and can short-circuit.
  if (
    Array.from(execResult.deferBoundaryResults).every(
      ([, { dataState }]) => dataState !== "partial"
    )
  ) {
    return execResult;
  }

  function removePartialFragmentData(
    selectionSet: SelectionSetNode,
    data: any
  ): any {
    if (data == null) return data;

    // Keep referential equality on as many subtrees as possible. Only return
    // the mutated result when its subtree has been changed.
    let changed = false;
    // __typename might not be part of the selection set so we want to preserve
    // it when available, otherwise it gets stripped since its never visited in
    // the selectionSet
    let newData: Record<string, any> =
      Object.hasOwn(data, "__typename") ? { __typename: data.__typename } : {};

    for (const selection of selectionSet.selections) {
      if (isField(selection)) {
        const { selectionSet } = selection;
        const resultName = resultKeyNameFromField(selection);
        const value = data[resultName];

        if (!selectionSet) {
          newData[resultName] = value;
          continue;
        }

        if (Array.isArray(value)) {
          newData[resultName] = value.map((item) => {
            const newItem = removePartialFragmentData(selectionSet, item);
            changed ||= newItem !== item;

            return newItem;
          });
        } else {
          const result = removePartialFragmentData(selectionSet, value);

          newData[resultName] = result;
          changed ||= result !== value;
        }
      } else {
        const fragmentResult = execResult.deferBoundaryResults?.get(selection);
        const dataState = fragmentResult?.dataState;

        // deferPartial -> this fragment satisfies its selection set, but a
        // nested defer boundary is partial
        if (dataState === "deferPartial") {
          const fragment = getFragmentFromSelection(selection, fragmentMap);
          if (!fragment) continue;

          newData = {
            ...newData,
            ...removePartialFragmentData(fragment.selectionSet, data),
          };

          changed = true;
        } else if (dataState === "partial") {
          newData = keepFieldsFromFieldMap(
            data,
            collectSiblingFields(selectionSet, {
              exclude: selection,
              fragmentMap,
            })
          );

          changed = true;
        } else {
          // If the fragment is complete, make sure its fields are copied over
          // to newData in case a sibling ends up removing partial fragments and
          // returning newData
          newData = { ...data };
        }
      }
    }

    return changed ? newData : data;
  }

  return {
    ...execResult,
    dataState: "streaming",
    result: removePartialFragmentData(
      getMainDefinition(document).selectionSet,
      execResult.result
    ),
  };
}

function keepFieldsFromFieldMap(
  data: Record<string, any> | any[],
  fieldMap: FieldMap
): any {
  if (Array.isArray(data)) {
    return data.map((item) => keepFieldsFromFieldMap(item, fieldMap));
  }

  return Object.entries(data).reduce<Record<string, any>>(
    (memo, [key, value]) => {
      const siblingField = fieldMap[key];

      if (siblingField === true || key === "__typename") {
        memo[key] = value;
      } else if (typeof siblingField === "object") {
        memo[key] = keepFieldsFromFieldMap(data[key], siblingField);
      }

      return memo;
    },
    {}
  );
}

const TRANSITIONS: Record<DataState, Partial<Record<DataState, DataState>>> = {
  empty: {
    partial: "partial",
    complete: "partial",
    streaming: "partial",
    deferPartial: "partial",
  },
  deferPartial: {
    partial: "partial",
    empty: "partial",
  },
  streaming: {
    deferPartial: "deferPartial",
    partial: "partial",
    empty: "partial",
  },
  complete: {
    partial: "partial",
    streaming: "streaming",
    deferPartial: "deferPartial",
    empty: "partial",
  },
  // partial is a final state because no other state change it
  partial: {},
};

function transitionTo(
  dataState: DataState | undefined,
  newDataState: DataState
) {
  if (!dataState || dataState === newDataState) {
    return newDataState;
  }

  return TRANSITIONS[dataState][newDataState] || dataState;
}
