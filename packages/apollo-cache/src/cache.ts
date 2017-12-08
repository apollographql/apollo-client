import { DocumentNode } from 'graphql';
import { getFragmentQueryDocument } from 'apollo-utilities';

import { DataProxy, Cache } from './types';

export type Transaction<T, U = T> = (c: ApolloCache<T, U>) => void;

export abstract class ApolloCache<TCache, TSerializedCache = TCache>
  implements DataProxy {
  // required to implement
  // core API
  public abstract read<T>(query: Cache.ReadOptions): T | null;
  public abstract write(write: Cache.WriteOptions): void;
  public abstract diff<T>(query: Cache.DiffOptions): Cache.DiffResult<T>;
  public abstract watch(watch: Cache.WatchOptions): () => void;
  public abstract evict(query: Cache.EvictOptions): Cache.EvictionResult;
  public abstract reset(): Promise<void>;

  // intializer / offline / ssr API
  /**
   * Replaces existing state in the cache (if any) with the values expressed by
   * `serializedState`.
   *
   * Called when hydrating a cache (server side rendering, or offline storage),
   * and also (potentially) during hot reloads.
   */
  public abstract restore(
    serializedState: TSerializedCache,
  ): ApolloCache<TCache, TSerializedCache>;

  /**
   * Exposes the cache's complete state, in a serializable format for later restoration.
   */
  public abstract extract(optimistic?: boolean): TSerializedCache;

  // optimistic API
  public abstract removeOptimistic(id: string): void;

  // transactional API
  public abstract performTransaction(transaction: Transaction<TCache>): void;
  public abstract recordOptimisticTransaction(
    transaction: Transaction<TCache>,
    id: string,
  ): void;

  // optional API
  public transformDocument(document: DocumentNode): DocumentNode {
    return document;
  }
  // experimental
  public transformForLink(document: DocumentNode): DocumentNode {
    return document;
  }

  // DataProxy API
  /**
   *
   * @param options
   * @param optimistic
   */
  public readQuery<QueryType>(
    options: DataProxy.Query,
    optimistic: boolean = false,
  ): QueryType | null {
    return this.read({
      query: options.query,
      variables: options.variables,
      optimistic,
    });
  }

  public readFragment<FragmentType>(
    options: DataProxy.Fragment,
    optimistic: boolean = false,
  ): FragmentType | null {
    return this.read({
      query: getFragmentQueryDocument(options.fragment, options.fragmentName),
      variables: options.variables,
      rootId: options.id,
      optimistic,
    });
  }

  public writeQuery(options: Cache.WriteQueryOptions): void {
    this.write({
      dataId: 'ROOT_QUERY',
      result: options.data,
      query: options.query,
      variables: options.variables,
    });
  }

  public writeFragment(options: Cache.WriteFragmentOptions): void {
    this.write({
      dataId: options.id,
      result: options.data,
      variables: options.variables,
      query: getFragmentQueryDocument(options.fragment, options.fragmentName),
    });
  }
}
