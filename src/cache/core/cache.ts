import { DocumentNode } from 'graphql';
import { wrap } from 'optimism';

import {
  StoreObject,
  Reference,
  getFragmentQueryDocument,
} from '../../utilities';
import { DataProxy } from './types/DataProxy';
import { Cache } from './types/Cache';

export type Transaction<T> = (c: ApolloCache<T>) => void;

export abstract class ApolloCache<TSerialized> implements DataProxy {
  // required to implement
  // core API
  public abstract read<TData = any, TVariables = any>(
    query: Cache.ReadOptions<TVariables, TData>,
  ): TData | null;
  public abstract write<TData = any, TVariables = any>(
    write: Cache.WriteOptions<TData, TVariables>,
  ): Reference | undefined;
  public abstract diff<T>(query: Cache.DiffOptions): Cache.DiffResult<T>;
  public abstract watch<TData = any, TVariables = any>(
    watch: Cache.WatchOptions<TData, TVariables>,
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
    serializedState: TSerialized,
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
      typeof options.optimistic === "string" ? options.optimistic :
      options.optimistic === false ? null : void 0;
    let updateResult: U;
    this.performTransaction(
      () => updateResult = options.update(this),
      optimisticId,
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
    optimisticId?: string | null,
  ): void;

  public recordOptimisticTransaction(
    transaction: Transaction<TSerialized>,
    optimisticId: string,
  ) {
    this.performTransaction(transaction, optimisticId);
  }

  // Optional API

  public transformDocument(document: DocumentNode): DocumentNode {
    return document;
  }

  public identify(object: StoreObject | Reference): string | undefined {
    return;
  }

  public gc(): string[] {
    return [];
  }

  public modify(options: Cache.ModifyOptions): boolean {
    return false;
  }

  // Experimental API

  public transformForLink(document: DocumentNode): DocumentNode {
    return document;
  }

  // DataProxy API
  /**
   *
   * @param options
   * @param optimistic
   */
  public readQuery<QueryType, TVariables = any>(
    options: Cache.ReadQueryOptions<QueryType, TVariables>,
    optimistic = !!options.optimistic,
  ): QueryType | null {
    return this.read({
      ...options,
      rootId: options.id || 'ROOT_QUERY',
      optimistic,
    });
  }

  // Make sure we compute the same (===) fragment query document every
  // time we receive the same fragment in readFragment.
  private getFragmentDoc = wrap(getFragmentQueryDocument);

  public readFragment<FragmentType, TVariables = any>(
    options: Cache.ReadFragmentOptions<FragmentType, TVariables>,
    optimistic = !!options.optimistic,
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
    return this.write(Object.assign(options, {
      dataId: id || 'ROOT_QUERY',
      result: data,
    }));
  }

  public writeFragment<TData = any, TVariables = any>({
    id,
    data,
    fragment,
    fragmentName,
    ...options
  }: Cache.WriteFragmentOptions<TData, TVariables>): Reference | undefined {
    return this.write(Object.assign(options, {
      query: this.getFragmentDoc(fragment, fragmentName),
      dataId: id,
      result: data,
    }));
  }

  public updateQuery<TData = any, TVariables = any>(
    options: Cache.UpdateQueryOptions<TData, TVariables>,
    update: (data: TData | null) => TData | null | void,
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
    update: (data: TData | null) => TData | null | void,
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
}
