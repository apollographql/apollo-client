import type { DocumentNode } from "graphql";
import { wrap } from "optimism";

import type {
  StoreObject,
  Reference,
  DeepPartial,
} from "../../utilities/index.js";
import {
  Observable,
  cacheSizes,
  defaultCacheSizes,
  getFragmentQueryDocument,
  mergeDeepArray,
} from "../../utilities/index.js";
import type { DataProxy } from "./types/DataProxy.js";
import type { Cache } from "./types/Cache.js";
import { WeakCache } from "@wry/caches";
import { getApolloCacheMemoryInternals } from "../../utilities/caching/getMemoryInternals.js";
import type {
  OperationVariables,
  TypedDocumentNode,
} from "../../core/types.js";
import { equal } from "@wry/equality";
import type { MissingTree } from "./types/common.js";

export type Transaction<T> = (c: ApolloCache<T>) => void;

/**
 * Watched fragment options.
 */
export interface WatchFragmentOptions<TData, TVars> {
  /**
   * A GraphQL fragment document parsed into an AST with the `gql`
   * template literal.
   *
   * @docGroup 1. Required options
   */
  fragment: DocumentNode | TypedDocumentNode<TData, TVars>;
  /**
   * An object containing a `__typename` and primary key fields
   * (such as `id`) identifying the entity object from which the fragment will
   * be retrieved, or a `{ __ref: "..." }` reference, or a `string` ID
   * (uncommon).
   *
   * @docGroup 1. Required options
   */
  from: StoreObject | Reference | string;
  /**
   * Any variables that the GraphQL fragment may depend on.
   *
   * @docGroup 2. Cache options
   */
  variables?: TVars;
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
  /**
   * @deprecated
   * Using `canonizeResults` can result in memory leaks so we generally do not
   * recommend using this option anymore.
   * A future version of Apollo Client will contain a similar feature.
   *
   * Whether to canonize cache results before returning them. Canonization
   * takes some extra time, but it speeds up future deep equality comparisons.
   * Defaults to false.
   */
  canonizeResults?: boolean;
}

/**
 * Watched fragment results.
 */
export type WatchFragmentResult<TData> =
  | {
      data: TData;
      complete: true;
      missing?: never;
    }
  | {
      data: DeepPartial<TData>;
      complete: false;
      missing: MissingTree;
    };

export abstract class ApolloCache<TSerialized> implements DataProxy {
  public readonly assumeImmutableResults: boolean = false;

  // required to implement
  // core API
  public abstract read<TData = any, TVariables = any>(
    query: Cache.ReadOptions<TVariables, TData>
  ): TData | null;
  public abstract write<TData = any, TVariables = any>(
    write: Cache.WriteOptions<TData, TVariables>
  ): Reference | undefined;
  public abstract diff<T>(query: Cache.DiffOptions): Cache.DiffResult<T>;
  public abstract watch<TData = any, TVariables = any>(
    watch: Cache.WatchOptions<TData, TVariables>
  ): () => void;

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
  public abstract restore(
    serializedState: TSerialized
  ): ApolloCache<TSerialized>;

  /**
   * Exposes the cache's complete state, in a serializable format for later restoration.
   */
  public abstract extract(optimistic?: boolean): TSerialized;

  // Optimistic API

  public abstract removeOptimistic(id: string): void;

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
    transaction: Transaction<TSerialized>,
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
    transaction: Transaction<TSerialized>,
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

  // DataProxy API
  public readQuery<QueryType, TVariables = any>(
    options: Cache.ReadQueryOptions<QueryType, TVariables>,
    optimistic = !!options.optimistic
  ): QueryType | null {
    return this.read({
      ...options,
      rootId: options.id || "ROOT_QUERY",
      optimistic,
    });
  }

  /** {@inheritDoc @apollo/client!ApolloClient#watchFragment:member(1)} */
  public watchFragment<TData = any, TVars = OperationVariables>(
    options: WatchFragmentOptions<TData, TVars>
  ): Observable<WatchFragmentResult<TData>> {
    const { fragment, fragmentName, from, optimistic = true } = options;

    const diffOptions: Cache.DiffOptions<TData, TVars> = {
      returnPartialData: true,
      id: typeof from === "string" ? from : this.identify(from),
      query: this.getFragmentDoc(fragment, fragmentName),
      optimistic,
    };

    let latestDiff: DataProxy.DiffResult<TData> | undefined;

    return new Observable((observer) => {
      return this.watch<TData, TVars>({
        ...diffOptions,
        immediate: true,
        query: this.getFragmentDoc(fragment, fragmentName),
        callback(diff) {
          if (equal(diff, latestDiff)) {
            return;
          }

          const result = {
            data: diff.result as DeepPartial<TData>,
            complete: !!diff.complete,
          } as WatchFragmentResult<TData>;

          if (diff.missing) {
            result.missing = mergeDeepArray(
              diff.missing.map((error) => error.missing)
            );
          }

          latestDiff = diff;
          observer.next(result);
        },
      });
    });
  }

  // Make sure we compute the same (===) fragment query document every
  // time we receive the same fragment in readFragment.
  private getFragmentDoc = wrap(getFragmentQueryDocument, {
    max:
      cacheSizes["cache.fragmentQueryDocuments"] ||
      defaultCacheSizes["cache.fragmentQueryDocuments"],
    cache: WeakCache,
  });

  public readFragment<FragmentType, TVariables = any>(
    options: Cache.ReadFragmentOptions<FragmentType, TVariables>,
    optimistic = !!options.optimistic
  ): FragmentType | null {
    return this.read({
      ...options,
      query: this.getFragmentDoc(options.fragment, options.fragmentName),
      rootId: options.id,
      optimistic,
    });
  }

  public writeQuery<TData = any, TVariables = any>({
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

  public writeFragment<TData = any, TVariables = any>({
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

  public updateQuery<TData = any, TVariables = any>(
    options: Cache.UpdateQueryOptions<TData, TVariables>,
    update: (data: TData | null) => TData | null | void
  ): TData | null {
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

  public updateFragment<TData = any, TVariables = any>(
    options: Cache.UpdateFragmentOptions<TData, TVariables>,
    update: (data: TData | null) => TData | null | void
  ): TData | null {
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
  public getMemoryInternals?: typeof getApolloCacheMemoryInternals;
}

if (__DEV__) {
  ApolloCache.prototype.getMemoryInternals = getApolloCacheMemoryInternals;
}
