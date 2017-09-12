import { DocumentNode } from 'graphql';
import { getFragmentQueryDocument } from 'apollo-utilities';

import { DataProxy, Cache } from './types';

export type Transaction = (c: ApolloCache) => void;

export abstract class ApolloCache implements DataProxy {
  // required to implement
  // core API
  public abstract read<T>(query: Cache.ReadOptions): Cache.DiffResult<T>;
  public abstract write(write: Cache.WriteOptions): void;
  public abstract diff<T>(query: Cache.DiffOptions): Cache.DiffResult<T>;
  public abstract watch(watch: Cache.WatchOptions): () => void;
  public abstract evict(query: Cache.EvictOptions): Cache.EvictionResult;
  public abstract getData(): any;
  public abstract reset(): Promise<void>;

  // optimistic API
  public abstract removeOptimistic(id: string): void;
  public abstract getOptimisticData(): any;

  // transactional API
  public abstract performTransaction(transaction: Transaction): void;
  public abstract recordOptimisticTransaction(
    transaction: Transaction,
    id: string,
  ): void;

  // optional API
  public transformDocument(document: DocumentNode): DocumentNode {
    return document;
  }

  public readQuery<QueryType>(
    options: DataProxy.Query,
    optimistic: boolean = false,
  ): Cache.DiffResult<QueryType> {
    return this.read({
      query: options.query,
      variables: options.variables,
      optimistic,
    });
  }

  public readFragment<FragmentType>(
    options: DataProxy.Fragment,
    optimistic: boolean = false,
  ): Cache.DiffResult<FragmentType> | null {
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
