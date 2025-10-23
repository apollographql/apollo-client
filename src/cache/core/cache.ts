import { WeakCache } from "@wry/caches";
import { equal } from "@wry/equality";
import { Trie } from "@wry/trie";
import type {
  DocumentNode,
  FragmentDefinitionNode,
  InlineFragmentNode,
} from "graphql";
import { wrap } from "optimism";
import {
  distinctUntilChanged,
  map,
  Observable,
  ReplaySubject,
  share,
  shareReplay,
  tap,
  timer,
} from "rxjs";

import type {
  DataValue,
  GetDataState,
  OperationVariables,
  TypedDocumentNode,
} from "@apollo/client";
import type { FragmentType, Unmasked } from "@apollo/client/masking";
import type { Reference, StoreObject } from "@apollo/client/utilities";
import { cacheSizes, canonicalStringify } from "@apollo/client/utilities";
import { __DEV__ } from "@apollo/client/utilities/environment";
import type { NoInfer } from "@apollo/client/utilities/internal";
import {
  combineLatestBatched,
  equalByQuery,
  getApolloCacheMemoryInternals,
  getFragmentDefinition,
  getFragmentQueryDocument,
} from "@apollo/client/utilities/internal";
import { invariant } from "@apollo/client/utilities/invariant";

import { defaultCacheSizes } from "../../utilities/caching/sizes.js";

import type { Cache } from "./types/Cache.js";
import type { MissingTree } from "./types/common.js";

export type Transaction = (c: ApolloCache) => void;

export declare namespace ApolloCache {
  export type WatchFragmentFromValue<TData> =
    | StoreObject
    | Reference
    | FragmentType<NoInfer<TData>>
    | string;
  /**
   * Watched fragment options.
   */
  export interface WatchFragmentOptions<
    TData = unknown,
    TVariables extends OperationVariables = OperationVariables,
  > {
    /**
     * A GraphQL fragment document parsed into an AST with the `gql`
     * template literal.
     *
     * @docGroup 1. Required options
     */
    fragment: DocumentNode | TypedDocumentNode<TData, TVariables>;
    /**
     * An object containing a `__typename` and primary key fields
     * (such as `id`) identifying the entity object from which the fragment will
     * be retrieved, or a `{ __ref: "..." }` reference, or a `string` ID
     * (uncommon).
     *
     * @docGroup 1. Required options
     */
    from:
      | ApolloCache.WatchFragmentFromValue<TData>
      | Array<ApolloCache.WatchFragmentFromValue<TData> | null>;
    /**
     * Any variables that the GraphQL fragment may depend on.
     *
     * @docGroup 2. Cache options
     */
    variables?: TVariables;
    /**
     * The name of the fragment defined in the fragment document.
     *
     * Required if the fragment document includes more than one fragment,
     * optional otherwise.
     *
     * @docGroup 2. Cache options
     */
    fragmentName?: string;
    /**
     * If `true`, `watchFragment` returns optimistic results.
     *
     * The default value is `true`.
     *
     * @docGroup 2. Cache options
     */
    optimistic?: boolean;
  }

  /**
   * Watched fragment results.
   */
  export type WatchFragmentResult<TData = unknown> =
    | ({
        complete: true;
        missing?: never;
      } & GetDataState<TData, "complete">)
    | {
        complete: false;
        missing?: MissingTree;
        /** {@inheritDoc @apollo/client!QueryResultDocumentation#data:member} */
        data: TData extends Array<infer TItem> ?
          Array<DataValue.Partial<TItem | null>>
        : DataValue.Partial<TData>;
        /** {@inheritDoc @apollo/client!QueryResultDocumentation#dataState:member} */
        dataState: "partial";
      };

  export interface ObservableFragment<TData = unknown>
    extends Observable<ApolloCache.WatchFragmentResult<TData>> {
    /**
     * Return the current result for the fragment.
     */
    getCurrentResult: () => ApolloCache.WatchFragmentResult<TData>;
  }

  export interface WatchFragmentReobserveOptions<TData = unknown> {
    from: TData extends Array<any> ?
      Array<StoreObject | Reference | FragmentType<TData> | string | null>
    : StoreObject | Reference | FragmentType<TData> | string;
  }
}

export abstract class ApolloCache {
  public readonly assumeImmutableResults: boolean = false;

  // required to implement
  // core API
  public abstract read<
    TData = unknown,
    TVariables extends OperationVariables = OperationVariables,
  >(query: Cache.ReadOptions<TData, TVariables>): Unmasked<TData> | null;
  public abstract write<
    TData = unknown,
    TVariables extends OperationVariables = OperationVariables,
  >(write: Cache.WriteOptions<TData, TVariables>): Reference | undefined;

  /**
   * Returns data read from the cache for a given query along with information
   * about the cache result such as whether the result is complete and details
   * about missing fields.
   *
   * Will return `complete` as `true` if it can fulfill the full cache result or
   * `false` if not. When no data can be fulfilled from the cache, `null` is
   * returned. When `returnPartialData` is `true`, non-null partial results are
   * returned if it contains at least one field that can be fulfilled from the
   * cache.
   */
  public abstract diff<
    TData = unknown,
    TVariables extends OperationVariables = OperationVariables,
  >(query: Cache.DiffOptions<TData, TVariables>): Cache.DiffResult<TData>;
  public abstract watch<
    TData = unknown,
    TVariables extends OperationVariables = OperationVariables,
  >(watch: Cache.WatchOptions<TData, TVariables>): () => void;

  // Empty the cache and restart all current watches (unless
  // options.discardWatches is true).
  public abstract reset(options?: Cache.ResetOptions): Promise<void>;

  // Remove whole objects from the cache by passing just options.id, or
  // specific fields by passing options.field and/or options.args. If no
  // options.args are provided, all fields matching options.field (even
  // those with arguments) will be removed. Returns true iff any data was
  // removed from the cache.
  public abstract evict(options: Cache.EvictOptions): boolean;

  // initializer / offline / ssr API
  /**
   * Replaces existing state in the cache (if any) with the values expressed by
   * `serializedState`.
   *
   * Called when hydrating a cache (server side rendering, or offline storage),
   * and also (potentially) during hot reloads.
   */
  public abstract restore(serializedState: unknown): this;

  /**
   * Exposes the cache's complete state, in a serializable format for later restoration.
   */
  public abstract extract(optimistic?: boolean): unknown;

  // Optimistic API

  public abstract removeOptimistic(id: string): void;

  // Used by data masking to determine if an inline fragment with a type
  // condition matches a given typename. Also used by local resolvers to match a
  // fragment against a typename.
  //
  // If not implemented by a cache subclass, data masking will effectively be
  // disabled since we will not be able to accurately determine if a given type
  // condition for a union or interface matches a particular type.
  public abstract fragmentMatches(
    fragment: InlineFragmentNode | FragmentDefinitionNode,
    typename: string
  ): boolean;

  // Function used to lookup a fragment when a fragment definition is not part
  // of the GraphQL document. This is useful for caches, such as InMemoryCache,
  // that register fragments ahead of time so they can be referenced by name.
  public lookupFragment(fragmentName: string): FragmentDefinitionNode | null {
    return null;
  }

  // Local state API

  /**
   * Determines whether a `@client` field can be resolved by the cache. Used
   * when `LocalState` does not have a local resolver that can resolve the
   * field.
   *
   * @remarks Cache implementations should return `true` if a mechanism in the
   * cache is expected to provide a value for the field. `LocalState` will set
   * the value of the field to `undefined` in order for the cache to handle it.
   *
   * Cache implementations should return `false` to indicate that it cannot
   * handle resolving the field (either because it doesn't have a mechanism to
   * do so, or because the user hasn't provided enough information to resolve
   * the field). Returning `false` will emit a warning and set the value of the
   * field to `null`.
   *
   * A cache that doesn't implement `resolvesClientField` will be treated the
   * same as returning `false`.
   */
  public resolvesClientField?(typename: string, fieldName: string): boolean;

  // Transactional API

  // The batch method is intended to replace/subsume both performTransaction
  // and recordOptimisticTransaction, but performTransaction came first, so we
  // provide a default batch implementation that's just another way of calling
  // performTransaction. Subclasses of ApolloCache (such as InMemoryCache) can
  // override the batch method to do more interesting things with its options.
  public batch<U>(options: Cache.BatchOptions<this, U>): U {
    const optimisticId =
      typeof options.optimistic === "string" ? options.optimistic
      : options.optimistic === false ? null
      : void 0;
    let updateResult: U;
    this.performTransaction(
      () => (updateResult = options.update(this)),
      optimisticId
    );
    return updateResult!;
  }

  public abstract performTransaction(
    transaction: Transaction,
    // Although subclasses may implement recordOptimisticTransaction
    // however they choose, the default implementation simply calls
    // performTransaction with a string as the second argument, allowing
    // performTransaction to handle both optimistic and non-optimistic
    // (broadcast-batching) transactions. Passing null for optimisticId is
    // also allowed, and indicates that performTransaction should apply
    // the transaction non-optimistically (ignoring optimistic data).
    optimisticId?: string | null
  ): void;

  public recordOptimisticTransaction(
    transaction: Transaction,
    optimisticId: string
  ) {
    this.performTransaction(transaction, optimisticId);
  }

  // Optional API

  // Called once per input document, allowing the cache to make static changes
  // to the query, such as adding __typename fields.
  public transformDocument(document: DocumentNode): DocumentNode {
    return document;
  }

  // Called before each ApolloLink request, allowing the cache to make dynamic
  // changes to the query, such as filling in missing fragment definitions.
  public transformForLink(document: DocumentNode): DocumentNode {
    return document;
  }

  public identify(object: StoreObject | Reference): string | undefined {
    return;
  }

  public gc(): string[] {
    return [];
  }

  public modify<Entity extends Record<string, any> = Record<string, any>>(
    options: Cache.ModifyOptions<Entity>
  ): boolean {
    return false;
  }

  /**
   * Read data from the cache for the specified query.
   */
  public readQuery<
    TData = unknown,
    TVariables extends OperationVariables = OperationVariables,
  >({
    // spread in type definitions for discoverability in the docs
    query,
    variables,
    id,
    optimistic,
    returnPartialData,
  }: Cache.ReadQueryOptions<TData, TVariables>): Unmasked<TData> | null;
  /**
   * {@inheritDoc @apollo/client!ApolloCache#readQuery:member(1)}
   */
  public readQuery<
    TData = unknown,
    TVariables extends OperationVariables = OperationVariables,
  >(
    options: Cache.ReadQueryOptions<TData, TVariables>,
    /**
     * @deprecated Pass the `optimistic` argument as part of the first argument
     * instead of passing it as a separate option.
     */
    optimistic: boolean
  ): Unmasked<TData> | null;
  public readQuery<
    TData = unknown,
    TVariables extends OperationVariables = OperationVariables,
  >(
    options: Cache.ReadQueryOptions<TData, TVariables>,
    optimistic = !!options.optimistic
  ): Unmasked<TData> | null {
    return this.read({
      ...options,
      rootId: options.id || "ROOT_QUERY",
      optimistic,
    });
  }

  private fragmentWatches = new Trie(
    true,
    (): {
      observable?: Observable<any>;
    } => ({})
  );

  public watchFragment<
    TData = unknown,
    TVariables extends OperationVariables = OperationVariables,
  >(
    options: ApolloCache.WatchFragmentOptions<TData, TVariables> & {
      from: Array<ApolloCache.WatchFragmentFromValue<TData>>;
    }
  ): ApolloCache.ObservableFragment<Array<Unmasked<TData>>>;

  public watchFragment<
    TData = unknown,
    TVariables extends OperationVariables = OperationVariables,
  >(
    options: ApolloCache.WatchFragmentOptions<TData, TVariables> & {
      from: Array<null>;
    }
  ): ApolloCache.ObservableFragment<Array<null>>;

  public watchFragment<
    TData = unknown,
    TVariables extends OperationVariables = OperationVariables,
  >(
    options: ApolloCache.WatchFragmentOptions<TData, TVariables> & {
      from: Array<ApolloCache.WatchFragmentFromValue<TData> | null>;
    }
  ): ApolloCache.ObservableFragment<Array<Unmasked<TData> | null>>;

  public watchFragment<
    TData = unknown,
    TVariables extends OperationVariables = OperationVariables,
  >(
    options: ApolloCache.WatchFragmentOptions<TData, TVariables>
  ): ApolloCache.ObservableFragment<Unmasked<TData>>;

  /** {@inheritDoc @apollo/client!ApolloClient#watchFragment:member(1)} */
  public watchFragment<
    TData = unknown,
    TVariables extends OperationVariables = OperationVariables,
  >(
    options: ApolloCache.WatchFragmentOptions<TData, TVariables>
  ):
    | ApolloCache.ObservableFragment<Unmasked<TData> | null>
    | ApolloCache.ObservableFragment<Array<Unmasked<TData> | null>> {
    const {
      fragment,
      fragmentName,
      from,
      optimistic = true,
      variables,
    } = options;
    const query = this.getFragmentDoc(
      fragment,
      fragmentName
    ) as TypedDocumentNode<TData, TVariables>;

    const fromArray = Array.isArray(from) ? from : [from];

    const ids = fromArray.map((value) => {
      // While our TypeScript types do not allow for `undefined` as a valid
      // `from`, its possible `useFragment` gives us an `undefined` since it
      // calls` cache.identify` and provides that value to `from`. We are
      // adding this fix here however to ensure those using plain JavaScript
      // and using `cache.identify` themselves will avoid seeing the obscure
      // warning.
      const id =
        (
          typeof value === "undefined" ||
          typeof value === "string" ||
          value === null
        ) ?
          value
        : this.identify(value);

      if (__DEV__) {
        const actualFragmentName =
          fragmentName || getFragmentDefinition(fragment).name.value;

        if (id === undefined) {
          invariant.warn(
            "Could not identify object passed to `from` for '%s' fragment, either because the object is non-normalized or the key fields are missing. If you are masking this object, please ensure the key fields are requested by the parent object.",
            actualFragmentName
          );
        }
      }

      return id as string | null;
    });

    let currentResult:
      | ApolloCache.WatchFragmentResult<Unmasked<TData> | null>
      | ApolloCache.WatchFragmentResult<Array<Unmasked<TData> | null>>;
    function toResult(diffs: Array<Cache.DiffResult<Unmasked<TData> | null>>) {
      let result:
        | ApolloCache.WatchFragmentResult<Unmasked<TData> | null>
        | ApolloCache.WatchFragmentResult<Array<Unmasked<TData> | null>>;
      if (Array.isArray(from)) {
        result = diffs.reduce(
          (result, diff, idx) => {
            const id = ids[idx];
            result.data.push(diff.result as any);
            result.complete &&= id === null ? true : diff.complete;
            result.dataState = result.complete ? "complete" : "partial";

            if (diff.missing) {
              result.missing ||= {};
              (result.missing as any)[idx] = diff.missing.missing;
            }

            return result;
          },
          {
            data: [],
            dataState: "complete",
            complete: true,
          } as ApolloCache.WatchFragmentResult<Array<Unmasked<TData>>>
        );
      } else {
        const [diff] = diffs;
        result = {
          // Unfortunately we forgot to allow for `null` on watchFragment in 4.0
          // when `from` is a single record. As such, we need to fallback to {}
          // when diff.result is null to maintain backwards compatibility. We
          // should plan to change this in v5.
          //
          // NOTE: Using `from` with an array will maintain `null` properly
          // without the need for a similar fallback since watchFragment with
          // arrays is new functionality in v4.
          data: diff.result ?? {},
          complete: !!diff.complete,
          dataState: diff.complete ? "complete" : "partial",
        } as ApolloCache.WatchFragmentResult<Unmasked<TData>>;

        if (diff.missing) {
          result.missing = diff.missing.missing;
        }
      }

      if (!equal(currentResult, result)) {
        currentResult = result;
      }

      return currentResult;
    }

    let subscribed = false;
    const observable =
      ids.length === 0 ?
        emptyArrayObservable
      : (combineLatestBatched(
          ids.map((id) => this.watchSingleFragment(id, query, options))
        ).pipe(
          map(toResult),
          tap({
            subscribe: () => (subscribed = true),
            unsubscribe: () => (subscribed = false),
          }),
          shareReplay({ bufferSize: 1, refCount: true })
        ) satisfies Observable<
          | ApolloCache.WatchFragmentResult<Unmasked<TData> | null>
          | ApolloCache.WatchFragmentResult<(Unmasked<TData> | null)[]>
        > as
          | Observable<ApolloCache.WatchFragmentResult<Unmasked<TData> | null>>
          | Observable<
              ApolloCache.WatchFragmentResult<Array<Unmasked<TData> | null>>
            >);

    return Object.assign(observable, {
      getCurrentResult: () => {
        if (subscribed && currentResult) {
          return currentResult as any;
        }

        const diffs = ids.map((id): Cache.DiffResult<Unmasked<TData>> => {
          if (id === null) {
            return { result: null, complete: false };
          }

          return this.diff<Unmasked<TData>>({
            id,
            query,
            returnPartialData: true,
            optimistic,
            variables,
          });
        });

        return toResult(diffs);
      },
    } satisfies Pick<
      | ApolloCache.ObservableFragment<Unmasked<TData> | null>
      | ApolloCache.ObservableFragment<Array<Unmasked<TData> | null>>,
      "getCurrentResult"
    >) as any;
  }

  private watchSingleFragment<
    TData = unknown,
    TVariables extends OperationVariables = OperationVariables,
  >(
    id: string | null,
    fragmentQuery: TypedDocumentNode<TData, TVariables>,
    options: Omit<
      ApolloCache.WatchFragmentOptions<TData, TVariables>,
      "from" | "fragment" | "fragmentName"
    >
  ): Observable<Cache.DiffResult<Unmasked<TData> | null>> {
    if (id === null) {
      return nullObservable;
    }

    const { optimistic = true, variables } = options;

    const cacheKey = [
      fragmentQuery,
      canonicalStringify({ id, optimistic, variables }),
    ];
    const cacheEntry = this.fragmentWatches.lookupArray(cacheKey);

    cacheEntry.observable ??= new Observable<Cache.DiffResult<TData>>(
      (observer) => {
        const cleanup = this.watch<TData, TVariables>({
          variables,
          returnPartialData: true,
          id,
          query: fragmentQuery,
          optimistic,
          immediate: true,
          callback: (diff) => {
            observer.next(diff);
          },
        });
        return () => {
          cleanup();
          this.fragmentWatches.removeArray(cacheKey);
        };
      }
    ).pipe(
      distinctUntilChanged((previous, current) =>
        equalByQuery(
          fragmentQuery,
          { data: previous.result },
          { data: current.result },
          options.variables
        )
      ),
      share({
        connector: () => new ReplaySubject(1),
        // debounce so a synchronous unsubscribe+resubscribe doesn't tear down the watch and create a new one
        resetOnRefCountZero: () => timer(0),
      })
    );

    return cacheEntry.observable;
  }

  // Make sure we compute the same (===) fragment query document every
  // time we receive the same fragment in readFragment.
  private getFragmentDoc = wrap(getFragmentQueryDocument, {
    max:
      cacheSizes["cache.fragmentQueryDocuments"] ||
      defaultCacheSizes["cache.fragmentQueryDocuments"],
    cache: WeakCache,
  });

  /**
   * Read data from the cache for the specified fragment.
   */
  public readFragment<
    TData = unknown,
    TVariables extends OperationVariables = OperationVariables,
  >({
    // spread in type definitions for discoverability in the docs
    fragment,
    variables,
    fragmentName,
    id,
    optimistic,
    returnPartialData,
  }: Cache.ReadFragmentOptions<TData, TVariables>): Unmasked<TData> | null;
  public readFragment<
    TData = unknown,
    TVariables extends OperationVariables = OperationVariables,
  >(
    options: Cache.ReadFragmentOptions<TData, TVariables>,
    /**
     * @deprecated Pass the `optimistic` argument as part of the first argument
     * instead of passing it as a separate option.
     */
    optimistic: boolean
  ): Unmasked<TData> | null;
  public readFragment<
    TData = unknown,
    TVariables extends OperationVariables = OperationVariables,
  >(
    options: Cache.ReadFragmentOptions<TData, TVariables>,
    optimistic = !!options.optimistic
  ): Unmasked<TData> | null {
    return this.read({
      ...options,
      query: this.getFragmentDoc(options.fragment, options.fragmentName),
      rootId: options.id,
      optimistic,
    });
  }

  /**
   * Writes data to the root of the cache using the specified query to validate that
   * the shape of the data you’re writing to the cache is the same as the shape of
   * the data required by the query. Great for prepping the cache with initial data.
   */
  public writeQuery<
    TData = unknown,
    TVariables extends OperationVariables = OperationVariables,
  >({
    // spread in type definitions for discoverability in the docs
    data,
    query,
    variables,
    overwrite,
    id,
    broadcast,
  }: Cache.WriteQueryOptions<TData, TVariables>): Reference | undefined;
  public writeQuery<
    TData = unknown,
    TVariables extends OperationVariables = OperationVariables,
  >({
    id,
    data,
    ...options
  }: Cache.WriteQueryOptions<TData, TVariables>): Reference | undefined {
    return this.write(
      Object.assign(options, {
        dataId: id || "ROOT_QUERY",
        result: data,
      })
    );
  }

  /**
   * Similar to `writeQuery` (writes data to the cache) but uses the specified
   * fragment to validate that the shape of the data you’re writing to the cache
   * is the same as the shape of the data required by the fragment.
   */
  public writeFragment<
    TData = unknown,
    TVariables extends OperationVariables = OperationVariables,
  >({
    // spread in type definitions for discoverability in the docs
    data,
    fragment,
    fragmentName,
    variables,
    overwrite,
    id,
    broadcast,
  }: Cache.WriteFragmentOptions<TData, TVariables>): Reference | undefined;
  public writeFragment<
    TData = unknown,
    TVariables extends OperationVariables = OperationVariables,
  >({
    id,
    data,
    fragment,
    fragmentName,
    ...options
  }: Cache.WriteFragmentOptions<TData, TVariables>): Reference | undefined {
    return this.write(
      Object.assign(options, {
        query: this.getFragmentDoc(fragment, fragmentName),
        dataId: id,
        result: data,
      })
    );
  }

  public updateQuery<
    TData = unknown,
    TVariables extends OperationVariables = OperationVariables,
  >(
    options: Cache.UpdateQueryOptions<TData, TVariables>,
    update: (data: Unmasked<TData> | null) => Unmasked<TData> | null | void
  ): Unmasked<TData> | null {
    return this.batch({
      update(cache) {
        const value = cache.readQuery<TData, TVariables>(options);
        const data = update(value);
        if (data === void 0 || data === null) return value;
        cache.writeQuery<TData, TVariables>({ ...options, data });
        return data;
      },
    });
  }

  public updateFragment<
    TData = unknown,
    TVariables extends OperationVariables = OperationVariables,
  >(
    options: Cache.UpdateFragmentOptions<TData, TVariables>,
    update: (data: Unmasked<TData> | null) => Unmasked<TData> | null | void
  ): Unmasked<TData> | null {
    return this.batch({
      update(cache) {
        const value = cache.readFragment<TData, TVariables>(options);
        const data = update(value);
        if (data === void 0 || data === null) return value;
        cache.writeFragment<TData, TVariables>({ ...options, data });
        return data;
      },
    });
  }

  /**
   * @experimental
   * @internal
   * This is not a stable API - it is used in development builds to expose
   * information to the DevTools.
   * Use at your own risk!
   */
  public declare getMemoryInternals?: typeof getApolloCacheMemoryInternals;
}

if (__DEV__) {
  ApolloCache.prototype.getMemoryInternals = getApolloCacheMemoryInternals;
}

const nullObservable = new Observable<Cache.DiffResult<null>>((observer) => {
  observer.next({
    result: null,
    complete: false,
  });
});

const emptyArrayObservable = new Observable<
  ApolloCache.WatchFragmentResult<never[]>
>((observer) => {
  observer.next({
    data: [],
    dataState: "complete",
    complete: true,
  });
});
