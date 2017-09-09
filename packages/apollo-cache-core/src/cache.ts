import { DocumentNode } from 'graphql';

import { getFragmentQueryDocument } from 'apollo-utilities';

import { DataProxy, Cache } from './types';

export type Transaction = (c: ApolloCache) => void;

export abstract class ApolloCache implements DataProxy {
  public abstract reset(): Promise<void>;

  public abstract transformDocument(document: DocumentNode): DocumentNode;

  public abstract diffQuery<T>(
    query: Cache.DiffQueryOptions,
  ): Cache.DiffResult<T>;

  public abstract read<T>(query: Cache.ReadOptions): Cache.DiffResult<T>;

  public abstract writeResult(write: Cache.WriteResult): void;

  public abstract removeOptimistic(id: string): void;
  public abstract getOptimisticData(): any;

  public abstract performTransaction(transaction: Transaction): void;
  public abstract recordOptimisticTransaction(
    transaction: Transaction,
    id: string,
  ): void;

  public abstract watch(watch: Cache.WatchOptions): () => void;

  public writeQuery(options: Cache.WriteQueryOptions): void {
    this.writeResult({
      dataId: 'ROOT_QUERY',
      result: options.data,
      document: options.query,
      variables: options.variables,
    });
  }

  public writeFragment(options: Cache.WriteFragmentOptions): void {
    let document = getFragmentQueryDocument(
      options.fragment,
      options.fragmentName,
    );
    this.writeResult({
      dataId: options.id,
      result: options.data,
      document,
      variables: options.variables,
    });
  }

  public readQuery<QueryType>(
    options: DataProxy.ReadQueryOptions,
    optimistic: boolean = false,
  ): Cache.DiffResult<QueryType> {
    return this.read({
      query: options.query,
      variables: options.variables,
      optimistic,
    });
  }

  public readFragment<FragmentType>(
    options: DataProxy.ReadFragmentOptions,
    optimistic: boolean = false,
  ): Cache.DiffResult<FragmentType> | null {
    let document = getFragmentQueryDocument(
      options.fragment,
      options.fragmentName,
    );
    return this.read({
      query: document,
      variables: options.variables,
      rootId: options.id,
      optimistic,
    });
  }
}
