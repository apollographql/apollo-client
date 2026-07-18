import { Trie } from "@wry/trie";
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
  isStreamField,
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
  // at least 1 defer boundary is partial. All non-incremental fields complete
  | "deferPartial"
  // at least 1 stream boundary is partial. All non-incremental fields complete
  | "streamPartial"
  // All defer boundaries are complete or empty (but not partial) or all stream
  // boundaries are complete (but not partial)
  | "streaming"
  // All fields have data
  | "complete";

interface ReadContext extends ReadMergeModifyContext {
  query: DocumentNode;
  policies: Policies;
  fragmentMap: FragmentMap;
  lookupFragment: FragmentMapFunction;
}

type ExecResult<R = any> = {
  result: R;
  dataState: DataState;
  partialBoundaries: PartialBoundaries;
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
    const context: ReadContext = {
      store,
      query,
      policies,
      variables,
      varString: canonicalStringify(variables),
      ...extractFragmentContext(query, this.config.fragments),
    };
    let execResult = this.executeSelectionSet({
      selectionSet: getMainDefinition(query).selectionSet,
      objectOrReference: rootRef,
      enclosingRef: rootRef,
      context,
    });

    // Since executeSelectionSet doesn't know about returnPartialData, we need
    // to perform a 2nd pass over the result to prune any fields inside
    // partial defer boundaries. The "deferPartial" data state tells us that the
    // only part of the result that contributed to its partiality is data inside
    // a defer boundary.
    if (
      handleIncremental &&
      !returnPartialData &&
      (execResult.dataState === "deferPartial" ||
        execResult.dataState === "streamPartial")
    ) {
      execResult = this.prunePartialBoundaries(query, execResult, context);
    }

    let { result, dataState } = execResult;

    let missing: MissingFieldError | undefined;
    if (
      execResult.missing &&
      // We don't need to report missing fields inside defer boundaries since
      // the "streaming" dataState tells us that the only missing fields in
      // the object is inside a defer boundary.
      (dataState !== "streaming" || !handleIncremental)
    ) {
      missing = new MissingFieldError(
        firstMissing(execResult.missing)!,
        execResult.missing,
        query,
        variables
      );
    }

    // If we get all root @defer boundaries with an empty result, report it as
    // empty instead of streaming.
    if (dataState === "streaming" && Object.keys(result).length === 0) {
      dataState = "empty";
    }

    if (
      dataState === "deferPartial" ||
      dataState === "streamPartial" ||
      (dataState === "streaming" && !handleIncremental)
    ) {
      dataState = "partial";
    }

    if (dataState === "partial" && !returnPartialData) {
      dataState = "empty";
    }

    const complete = dataState === "complete";

    result =
      (
        complete ||
        dataState === "streaming" ||
        (returnPartialData && Object.keys(result).length)
      ) ?
        result
      : null;

    const diffResult = {
      result,
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
        partialBoundaries: new PartialBoundaries(),
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
    const partialBoundaries = new PartialBoundaries();

    if (typeof typename === "string" && !policies.rootIdsByTypename[typename]) {
      // Ensure we always include a default value for the __typename
      // field, if we have one. Note that this field can be overridden by other
      // merged objects.
      objectsToMerge.push({ __typename: typename });
    }

    function handleMissing<T>(result: ExecResult<T>, resultName: string) {
      if (result.missing) {
        missing = missingMerger.merge(missing, {
          [resultName]: result.missing,
        });
      }
      return result;
    }

    const workSet = new Set(selectionSet.selections);

    workSet.forEach((selection) => {
      // Omit fields with directives @skip(if: <truthy value>) or
      // @include(if: <falsy value>).
      if (!shouldInclude(selection, variables)) return;

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

            dataState = mergeDataState(dataState, "empty");
          }
        } else if (isArray(fieldValue)) {
          if (fieldValue.length > 0) {
            const execResult = handleMissing(
              this.executeSubSelectedArray({
                field: selection,
                array: fieldValue,
                enclosingRef,
                context,
              }),
              resultName
            );

            fieldValue = execResult.result;
            dataState = mergeDataState(dataState, execResult.dataState);
            partialBoundaries.set(resultName, execResult.partialBoundaries);
          } else {
            dataState = mergeDataState(dataState, "complete");
          }
        } else if (!selection.selectionSet) {
          // Auto-inserted __typename should not affect dataState (see empty
          // @defer boundaries, which must stay "empty" → parent "streaming").
          if (!addTypenameToDocument.added(selection)) {
            dataState = mergeDataState(dataState, "complete");
          }
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
          const execResult = handleMissing(
            this.executeSelectionSet({
              selectionSet: selection.selectionSet,
              objectOrReference: fieldValue as StoreObject | Reference,
              enclosingRef: isReference(fieldValue) ? fieldValue : enclosingRef,
              context,
            }),
            resultName
          );

          fieldValue = execResult.result;
          partialBoundaries.set(resultName, execResult.partialBoundaries);

          // If the object's fields resolved to an "empty" dataState (e.g. no
          // field resolved with a non-undefined value), but the fieldValue
          // object itself is present, this object should be considered
          // partial instead of empty. This also ensures defer boundaries that
          // select this object remain as partial defer boundaries rather than
          // mistakenly get reported as streaming. This is especially necessary
          // when combined with GraphQL Codegen which generates its type and
          // relies on the outer object to be absent when its fields haven't
          // streamed in. Reporting the defer boundary as "streaming" instead of
          // "partial" would otherwise have the potential to cause runtime
          // crashes since the runtime values and types would not line up
          // properly (types expect object to be undefined, but its instead
          // present without its fields)
          dataState = mergeDataState(
            dataState,
            execResult.dataState === "empty" ? "partial" : execResult.dataState
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
          // Prior to 4.3, this branch just flattened the fragment's
          // selectionSet into the existing workSet so that it continued
          // iterating as if the fragment didn't exist. The cache is
          // incremental aware as of 4.3 and as such, we need to resolve the
          // per-fragment selection set so that we can properly strip partial
          // defer fragment data when returnPartialData is false. We need to
          // call execSelectionSetImpl directly (non-cached version) so that we
          // scope the dataState correctly for its fields. Using the cached
          // executeSelectionSet can result in cache poisoning when combined
          // with the fragment registry where it might cache either a) an error
          // thrown when a registered fragment references a named fragment that
          // the query is expected to supply and doesn't or b) resolve to the
          // wrong data result when combined with queries that provide different
          // implementations of the same fragment (see inmemory/fragmentRegistry and
          // cache.diff/incremental tests which provide guards against this
          // behavior).
          const execResult = this.execSelectionSetImpl({
            selectionSet: fragment.selectionSet,
            objectOrReference,
            enclosingRef,
            context,
          });
          const { result, dataState: nextDataState } = execResult;

          partialBoundaries.merge(execResult.partialBoundaries);

          if (result !== void 0) {
            objectsToMerge.push(result);
          }

          if (execResult.missing) {
            missing = missingMerger.merge(missing, execResult.missing);
          }

          if (isDeferBoundary && nextDataState === "partial") {
            partialBoundaries.add(selection);
          }

          dataState = mergeDataState(
            dataState,
            isDeferBoundary ?
              nextDataState === "empty" ? "streaming"
              : nextDataState === "partial" ? "deferPartial"
              : nextDataState
            : nextDataState
          );
        }
      }
    });

    dataState ||= "complete";

    const result = mergeDeepArray(objectsToMerge);

    const finalResult: ExecResult = {
      result,
      missing,
      dataState,
      partialBoundaries,
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
    const partialBoundaries = new PartialBoundaries();

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

      let execResult: ExecResult | undefined;

      // This is a nested array, recurse
      if (isArray(item)) {
        execResult = this.executeSubSelectedArray({
          field,
          array: item,
          enclosingRef,
          context,
        });
      } else if (field.selectionSet) {
        execResult = this.executeSelectionSet({
          selectionSet: field.selectionSet,
          objectOrReference: item,
          enclosingRef: isReference(item) ? item : enclosingRef,
          context,
        });
      }

      if (execResult) {
        const isStreamed = isStreamField(field, context.variables);
        const { dataState: nextDataState } = execResult;

        partialBoundaries.set(
          i,
          nextDataState === "partial" ?
            // avoid mutating the execResult partialBoundaries object
            execResult.partialBoundaries.clone().add(field)
          : execResult.partialBoundaries
        );

        dataState = mergeDataState(
          dataState,
          isStreamed ?
            nextDataState === "partial" ?
              "streamPartial"
            : nextDataState
          : nextDataState
        );

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
      partialBoundaries,
    };
  }

  private prunedEntries = new Trie<{ data: any }>();
  private prunePartialBoundaries<T>(
    document: DocumentNode,
    execResult: ExecResult<T>,
    context: ReadContext
  ): ExecResult<T> {
    const { policies, lookupFragment, variables } = context;
    const merger = new DeepMerger();

    const pruneArray = (
      field: FieldNode,
      array: any[],
      boundaries: PartialBoundaries | undefined
    ): any[] => {
      if (!boundaries) return array;
      const entry = this.prunedEntries.lookup(field, array, boundaries);
      if (entry.data) return entry.data;

      let changed = false;

      const pruned = array.reduce<any[]>((memo, item, i) => {
        let prunedItem = item;
        const boundary = boundaries.getChild(i);

        if (Array.isArray(item)) {
          prunedItem = pruneArray(field, item, boundary);
        } else if (field.selectionSet) {
          prunedItem = prune(field.selectionSet, item, boundary);
        }

        if (!boundary?.has(field)) {
          memo.push(prunedItem);
        }

        changed ||= boundary?.has(field) || prunedItem !== item;

        return memo;
      }, []);

      return changed ? (entry.data = pruned) : array;
    };

    const prune = (
      selectionSet: SelectionSetNode,
      data: any,
      boundaries: PartialBoundaries | undefined
    ): any => {
      if (data == null || !boundaries) return data;
      const entry = this.prunedEntries.lookup(selectionSet, data, boundaries);

      if (entry.data) return entry.data;

      let changed = false;
      const result: Record<string, any> = {};

      // __typename might not be part of the selection set, so preserve it when
      // available, otherwise it gets removed since it's never visited when
      // iterating the selection set.
      if (Object.hasOwn(data, "__typename")) {
        result.__typename = data.__typename;
      }

      const workSet = new Set(selectionSet.selections);
      workSet.forEach((selection) => {
        if (!shouldInclude(selection, variables)) return;

        if (isField(selection)) {
          const resultName = resultKeyNameFromField(selection);

          if (!Object.hasOwn(data, resultName)) {
            return;
          }

          const fieldValue = data[resultName];

          if (Array.isArray(fieldValue)) {
            const pruned = pruneArray(
              selection,
              fieldValue,
              boundaries.getChild(resultName)
            );

            changed ||= pruned !== fieldValue;
            result[resultName] = pruned;
          } else if (!selection.selectionSet) {
            result[resultName] = fieldValue;
          } else {
            const pruned = prune(
              selection.selectionSet,
              fieldValue,
              boundaries.getChild(resultName)
            );

            changed ||= pruned !== fieldValue;

            // A response key can be selected by more than one selection (e.g. a
            // field and an overlapping fragment), so merge their kept fields.
            result[resultName] =
              Object.hasOwn(result, resultName) ?
                merger.merge(result[resultName], pruned)
              : pruned;
          }

          return;
        }

        const fragment = getFragmentFromSelection(selection, lookupFragment);

        if (!fragment || !policies.fragmentMatches(fragment, data.__typename)) {
          return;
        }

        if (boundaries.has(selection)) {
          return (changed = true);
        }

        fragment.selectionSet.selections.forEach(workSet.add, workSet);
      });

      changed ||= Object.keys(result).length !== Object.keys(data).length;

      return changed ? (entry.data = result) : data;
    };

    // Omit `missing` property since pruning puts it in a state that doesn't
    // report missing fields.
    return {
      partialBoundaries: execResult.partialBoundaries,
      dataState:
        execResult.dataState === "streamPartial" ? "complete" : "streaming",
      result: prune(
        getMainDefinition(document).selectionSet,
        execResult.result,
        execResult.partialBoundaries
      ),
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

// We deliberately leave `returnPartialData` out of `executeSelectionSet`'s
// cache key. `isFresh` runs during writes and cannot provide a reliable value
// for this option, so including it would prevent a reliable cache hit.
//
// When `returnPartialData` is false, `diffQueryAgainstStore` prunes data from
// partial @defer boundaries after reading the cached result. `DeferBoundaries`
// records the selection paths needed for that pass, including empty nodes along
// a path: overlapping non-deferred selections must still be rebuilt so fields
// contributed only by a partial deferred sibling are removed. The pruner can
// then skip unrelated result branches.
class PartialBoundaries {
  private selections = new Set<SelectionNode>();
  private children = new Map<string | number, PartialBoundaries>();

  add(selection: SelectionNode) {
    this.selections.add(selection);

    return this;
  }

  has(selection: SelectionNode) {
    return this.selections.has(selection);
  }

  getChild(key: string | number) {
    return this.children.get(key);
  }

  clone() {
    return new PartialBoundaries().merge(this);
  }

  set(key: string | number, boundary: PartialBoundaries) {
    const child = this.getChild(key);

    this.children.set(
      key,
      // Create a new PartialBoundaries instance to avoid mutating any cached
      // execResult partialBoundaries objects
      child ? child.clone().merge(boundary) : boundary
    );
  }

  merge(boundaries: PartialBoundaries) {
    boundaries.selections.forEach((selection) => this.add(selection));
    boundaries.children.forEach((child, key) => this.set(key, child));

    return this;
  }
}

// Describes the data state transitions that change the running state when it's
// combined with the next data state. Omitted object values represent
// "impossible" merges where the data state should remain the same.
const DATA_STATE_MERGES: Record<
  DataState,
  Partial<Record<DataState, DataState>>
> = {
  empty: {
    complete: "partial",
    deferPartial: "partial",
    streaming: "partial",
    streamPartial: "partial",
  },
  deferPartial: {
    empty: "partial",
  },
  streamPartial: {
    deferPartial: "deferPartial",
    empty: "partial",
  },
  streaming: {
    deferPartial: "deferPartial",
    empty: "partial",
    streamPartial: "deferPartial",
  },
  complete: {
    deferPartial: "deferPartial",
    streaming: "streaming",
    streamPartial: "streamPartial",
    empty: "partial",
  },
  partial: {},
};

function mergeDataState(
  current: DataState | undefined,
  next: DataState
): DataState {
  if (next === "partial") {
    return "partial";
  }

  if (!current || current === next) {
    return next;
  }

  return DATA_STATE_MERGES[current][next] || current;
}
