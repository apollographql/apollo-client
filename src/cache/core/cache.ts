import { DocumentNode } from 'graphql';

import { getFragmentQueryDocument } from '../../utilities/graphql/fragments';
import { DataProxy } from './types/DataProxy';
import { Cache } from './types/Cache';
import { queryFromPojo, fragmentFromPojo } from './utils';

export type Transaction<T> = (c: ApolloCache<T>) => void;

export abstract class ApolloCache<TSerialized> implements DataProxy {
  // required to implement
  // core API
  public abstract read<T, TVariables = any>(
    query: Cache.ReadOptions<TVariables>,
  ): T | null | PromiseLike<T | null>;

  public abstract write<TResult = any, TVariables = any>(
    write: Cache.WriteOptions<TResult, TVariables>,
  ): void | PromiseLike<void>;

  public abstract diff<T>(
    query: Cache.DiffOptions,
  ): Cache.DiffResult<T> | PromiseLike<Cache.DiffResult<T>>;

  public abstract watch(watch: Cache.WatchOptions): () => void;
  public abstract evict(dataId: string): boolean;
  public abstract reset(): PromiseLike<void>;

  // intializer / offline / ssr API
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

  // optimistic API
  public abstract removeOptimistic(id: string): void | PromiseLike<void>;

  // transactional API
  public abstract performTransaction(
    transaction: Transaction<TSerialized>,
  ): void | PromiseLike<void>;

  public abstract recordOptimisticTransaction(
    transaction: Transaction<TSerialized>,
    id: string,
  ): void | PromiseLike<void>;

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
  public readQuery<QueryType, TVariables = any>(
    options: DataProxy.Query<TVariables>,
    optimistic: boolean = false,
  ): QueryType | null | PromiseLike<QueryType | null> {
    return this.read({
      query: options.query,
      variables: options.variables,
      optimistic,
    });
  }

  public readFragment<FragmentType, TVariables = any>(
    options: DataProxy.Fragment<TVariables>,
    optimistic: boolean = false,
  ): FragmentType | null | PromiseLike<FragmentType | null> {
    return this.read({
      query: getFragmentQueryDocument(options.fragment, options.fragmentName),
      variables: options.variables,
      rootId: options.id,
      optimistic,
    });
  }

  public writeQuery<TData = any, TVariables = any>(
    options: Cache.WriteQueryOptions<TData, TVariables>,
  ): void | PromiseLike<void> {
    return this.write({
      dataId: 'ROOT_QUERY',
      result: options.data,
      query: options.query,
      variables: options.variables,
    });
  }

  public writeFragment<TData = any, TVariables = any>(
    options: Cache.WriteFragmentOptions<TData, TVariables>,
  ): void | PromiseLike<void> {
    return this.write({
      dataId: options.id,
      result: options.data,
      variables: options.variables,
      query: getFragmentQueryDocument(options.fragment, options.fragmentName),
    });
  }

  public writeData<TData = any>({
    id,
    data,
  }: Cache.WriteDataOptions<TData>): void | PromiseLike<void> {
    if (typeof id !== 'undefined') {
      const dataToWrite = {
        __typename: '__ClientData',
        ...data,
      };

      return this.writeFragment({
        id,
        fragment: fragmentFromPojo(dataToWrite),
        data: dataToWrite,
      });
    }

    return this.writeQuery({ query: queryFromPojo(data), data });
  }
}
