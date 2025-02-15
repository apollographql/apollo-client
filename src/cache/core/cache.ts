import type {
  DocumentNode,
  FragmentDefinitionNode,
  InlineFragmentNode,
} from "graphql";
import { wrap } from "optimism";

import type {
  StoreObject,
  Reference,
  DeepPartial,
  NoInfer,
} from "../../utilities/index.js";
import { Observable } from "rxjs";
import {
  cacheSizes,
  defaultCacheSizes,
  getFragmentDefinition,
  getFragmentQueryDocument,
} from "../../utilities/index.js";
import type { DataProxy } from "./types/DataProxy.js";
import type { Cache } from "./types/Cache.js";
import { WeakCache } from "@wry/caches";
import { getApolloCacheMemoryInternals } from "../../utilities/caching/getMemoryInternals.js";
import type {
  OperationVariables,
  TypedDocumentNode,
} from "../../core/types.js";
import type { MissingTree } from "./types/common.js";
import { equalByQuery } from "../../core/equalByQuery.js";
import { invariant } from "../../utilities/globals/index.js";
import { maskFragment } from "../../masking/index.js";
import type {
  FragmentType,
  MaybeMasked,
  Unmasked,
} from "../../masking/index.js";

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
  from: StoreObject | Reference | FragmentType<NoInfer<TData>> | string;
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
}

/**
 * Watched fragment results.
 */
export type WatchFragmentResult<TData> =
  | {
      data: MaybeMasked<TData>;
      complete: true;
      missing?: never;
    }
  | {
      data: DeepPartial<MaybeMasked<TData>>;
      complete: false;
      missing: MissingTree;
    };

export abstract class ApolloCache<TSerialized> implements DataProxy {
  public readonly assumeImmutableResults: boolean = false;

  // required to implement
  // core API
  public abstract read<TData = any, TVariables = any>(
    query: Cache.ReadOptions<TVariables, TData>
  ): Unmasked<TData> | null;
  public abstract write<TData = any, TVariables = any>(
    write: Cache.WriteOptions<TData, TVariables>
  ): Reference | undefined;

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

  // Data masking API

  // Used by data masking to determine if an inline fragment with a type
  // condition matches a given typename.
  //
  // If not implemented by a cache subclass, data masking will effectively be
  // disabled since we will not be able to accurately determine if a given type
  // condition for a union or interface matches a particular type.
  public fragmentMatches?(
    fragment: InlineFragmentNode,
    typename: string
  ): boolean;

  // Function used to lookup a fragment when a fragment definition is not part
  // of the GraphQL document. This is useful for caches, such as InMemoryCache,
  // that register fragments ahead of time so they can be referenced by name.
  public lookupFragment(fragmentName: string): FragmentDefinitionNode | null {
    return null;
  }

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
  ): Unmasked<QueryType> | null {
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
    const {
      fragment,
      fragmentName,
      from,
      optimistic = true,
      ...otherOptions
    } = options;
    const query = this.getFragmentDoc(fragment, fragmentName);
    // While our TypeScript types do not allow for `undefined` as a valid
    // `from`, its possible `useFragment` gives us an `undefined` since it
    // calls` cache.identify` and provides that value to `from`. We are
    // adding this fix here however to ensure those using plain JavaScript
    // and using `cache.identify` themselves will avoid seeing the obscure
    // warning.
    const id =
      typeof from === "undefined" || typeof from === "string" ?
        from
      : this.identify(from);
    const dataMasking = !!(options as any)[Symbol.for("apollo.dataMasking")];

    if (__DEV__) {
      const actualFragmentName =
        fragmentName || getFragmentDefinition(fragment).name.value;

      if (!id) {
        invariant.warn(
          "Could not identify object passed to `from` for '%s' fragment, either because the object is non-normalized or the key fields are missing. If you are masking this object, please ensure the key fields are requested by the parent object.",
          actualFragmentName
        );
      }
    }

    const diffOptions: Cache.DiffOptions<TData, TVars> = {
      ...otherOptions,
      returnPartialData: true,
      id,
      query,
      optimistic,
    };

    let latestDiff: DataProxy.DiffResult<TData> | undefined;

    return new Observable((observer) => {
      return this.watch<TData, TVars>({
        ...diffOptions,
        immediate: true,
        callback: (diff) => {
          let data =
            dataMasking ?
              maskFragment(diff.result, fragment, this, fragmentName)
            : diff.result;

          // TODO: Remove this once `watchFragment` supports `null` as valid
          // value emitted
          if (data === null) {
            data = {} as any;
          }

          if (
            // Always ensure we deliver the first result
            latestDiff &&
            equalByQuery(
              query,
              { data: latestDiff.result },
              { data },
              // TODO: Fix the type on WatchFragmentOptions so that TVars
              // extends OperationVariables
              options.variables as OperationVariables
            )
          ) {
            return;
          }

          const result = {
            data,
            complete: !!diff.complete,
          } as WatchFragmentResult<TData>;

          if (diff.missing) {
            result.missing = diff.missing.missing;
          }

          latestDiff = { ...diff, result: data } as DataProxy.DiffResult<TData>;
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
  ): Unmasked<FragmentType> | null {
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

  public updateFragment<TData = any, TVariables = any>(
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
  public getMemoryInternals?: typeof getApolloCacheMemoryInternals;
}

if (__DEV__) {
  ApolloCache.prototype.getMemoryInternals = getApolloCacheMemoryInternals;
}
