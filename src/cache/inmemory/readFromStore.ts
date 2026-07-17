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

type FragmentSelection = Exclude<SelectionNode, { kind: "Field" }>;

interface ReadContext extends ReadMergeModifyContext {
  query: DocumentNode;
  policies: Policies;
  fragmentMap: FragmentMap;
  lookupFragment: FragmentMapFunction;
}

type ExecResult<R = any> = {
  result: R;
  dataState: DataState;
  deferBoundaries: DeferBoundaries;
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

    // Since executeSelectionSet doesn't know about returnPartialData, we need
    // to perform a 2nd pass over the result to prune any fields inside
    // partial defer boundaries. The "deferPartial" data state tells us that the
    // only part of the result that contributed to its partiality is data inside
    // a defer boundary.
    if (
      handleIncremental &&
      execResult.dataState === "deferPartial" &&
      !returnPartialData
    ) {
      execResult = this.prunePartialDeferBoundaries(query, execResult, {
        policies,
        lookupFragment: fragmentContext.lookupFragment,
        variables,
      });
    }

    let { result, dataState } = execResult;

    let missing: MissingFieldError | undefined;
    if (
      execResult.missing &&
      // We don't need to report missing fields inside defer boundaries since
      // the "streaming" dataState tells us that the only missing fields in
      // the object is inside a defer boundary.
      (!handleIncremental || dataState !== "streaming")
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
        deferBoundaries: new DeferBoundaries(),
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
    const deferBoundaries = new DeferBoundaries();

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

            dataState = computeDataState(dataState, "empty");
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
            dataState = computeDataState(dataState, execResult.dataState);
            deferBoundaries.set(resultName, execResult.deferBoundaries);
          } else {
            dataState = computeDataState(dataState, "complete");
          }
        } else if (!selection.selectionSet) {
          dataState = computeDataState(dataState, "complete");
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
          deferBoundaries.set(resultName, execResult.deferBoundaries);

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
          dataState = computeDataState(
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

          deferBoundaries.merge(execResult.deferBoundaries);

          if (result !== void 0) {
            objectsToMerge.push(result);
          }

          if (execResult.missing) {
            missing = missingMerger.merge(missing, execResult.missing);
          }

          if (isDeferBoundary && nextDataState === "partial") {
            deferBoundaries.add(selection);
          }

          dataState = computeDataState(
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
      deferBoundaries,
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
    const deferBoundaries = new DeferBoundaries();

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
        dataState = computeDataState(dataState, execResult.dataState);
        deferBoundaries.set(i, execResult.deferBoundaries);

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
      deferBoundaries,
    };
  }

  private pruned = new Trie<{ data: any }>();
  private prunePartialDeferBoundaries<T>(
    document: DocumentNode,
    execResult: ExecResult<T>,
    context: Pick<ReadContext, "lookupFragment" | "policies" | "variables">
  ): ExecResult<T> {
    const { policies, lookupFragment, variables } = context;

    const prune = (
      selectionSet: SelectionSetNode,
      data: any,
      deferBoundaries: DeferBoundaries | undefined
    ): any => {
      if (data == null || !deferBoundaries) return data;
      const entry = this.pruned.lookup(selectionSet, data, deferBoundaries);

      if (entry.data) return entry.data;

      let changed = false;

      if (Array.isArray(data)) {
        const pruned = data.map((item, index) => {
          const prunedItem = prune(
            selectionSet,
            item,
            deferBoundaries.getChild(index)
          );

          changed ||= prunedItem !== item;

          return prunedItem;
        });

        return changed ? (entry.data = pruned) : data;
      }

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

          if (!selection.selectionSet) {
            result[resultName] = data[resultName];
            return;
          }

          const pruned = prune(
            selection.selectionSet,
            data[resultName],
            deferBoundaries.getChild(resultName)
          );

          changed ||= pruned !== data[resultName];

          // A response key can be selected by more than one selection (e.g. a
          // field and an overlapping fragment), so merge their kept fields.
          result[resultName] =
            Object.hasOwn(result, resultName) ?
              new DeepMerger().merge(result[resultName], pruned)
            : pruned;

          return;
        }

        const fragment = getFragmentFromSelection(selection, lookupFragment);

        if (!fragment || !policies.fragmentMatches(fragment, data.__typename)) {
          return;
        }

        // Only process fragments that aren't partial.
        if (deferBoundaries.has(selection)) {
          return (changed = true);
        }

        fragment.selectionSet.selections.forEach(workSet.add, workSet);
      });

      if (changed || Object.keys(result).length !== Object.keys(data).length) {
        return (entry.data = result);
      }

      // data is a union of all selections, so if we drop any fields and end up
      // with a different key length, we want to always use the computed result
      // since it is more correct.
      return data;
    };

    return {
      ...execResult,
      // Removing partial defer boundaries puts the data in a streaming state
      dataState: "streaming",
      result: prune(
        getMainDefinition(document).selectionSet,
        execResult.result,
        execResult.deferBoundaries
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

// We can't make executeSelectionSet aware of returnPartialData because of
// the isFresh method that uses executeSelectionSet's cached result. Using
// returnPartialData inside executeSelectionSetImpl means it would have to be
// part its cache key since returnPartialData affects the returned result.
// However, writeToStore (which calls isFresh) has no way to reliably get a
// returnPartialData value (there is no returnPartialData option when writing
// to the cache). so that it can reliably get a cache hit.
//
// Not having access to returnPartialData becomes a problem for partial data
// written inside defer boundaries. When returnPartialData is false, we keep
// all non-deferred fields, but remove data from any partial defer boundary in
// order to maintain completeness. This has to happen in diffQueryAgainstStore
// since it is aware of returnPartialData, but we want to avoid having to
// traverse the entire data object again just to figure out whether there are
// partial defer boundaries inside of it. DeferBoundaries records the locations
// of all partial defer boundaries so that we can traverse as little as
// possible. This makes it cheaper to determine when we need to actually iterate
// on the returned object to remove partial data from a defer boundary.
class DeferBoundaries {
  private selections = new Set<FragmentSelection>();
  private children = new Map<string | number, DeferBoundaries>();

  add(selection: FragmentSelection) {
    this.selections.add(selection);
  }

  has(selection: FragmentSelection) {
    return this.selections.has(selection);
  }

  getChild(key: string | number) {
    return this.children.get(key);
  }

  // Nest `child` under `key` in `target`. When a child already exists for that
  // key (an overlapping selection contributing the same response key), the two
  // are merged into a new node so neither input—both potentially cached—is
  // mutated.
  set(key: string | number, deferBoundary: DeferBoundaries) {
    const existing = this.getChild(key);

    if (!existing) {
      this.children.set(key, deferBoundary);
      return;
    }

    const merged = new DeferBoundaries();
    merged.merge(existing);
    merged.merge(deferBoundary);
    this.children.set(key, merged);
  }

  merge(deferBoundaries: DeferBoundaries) {
    deferBoundaries.selections.forEach((selection) => this.add(selection));
    deferBoundaries.children.forEach((child, key) => this.set(key, child));
  }
}

// Describes the final data states when the current state (outer object) is
// combined with the next state (inner object). A missing dataState in the inner
// object means the dataState should remain the same.
const COMBINATIONS: Record<DataState, Partial<Record<DataState, DataState>>> = {
  empty: {
    complete: "partial",
    streaming: "partial",
    deferPartial: "partial",
  },
  deferPartial: {
    empty: "partial",
  },
  streaming: {
    deferPartial: "deferPartial",
    empty: "partial",
  },
  complete: {
    streaming: "streaming",
    deferPartial: "deferPartial",
    empty: "partial",
  },
  partial: {},
};

function computeDataState(
  current: DataState | undefined,
  next: DataState
): DataState {
  if (next === "partial") {
    return "partial";
  }

  if (!current || current === next) {
    return next;
  }

  return COMBINATIONS[current][next] || current;
}
