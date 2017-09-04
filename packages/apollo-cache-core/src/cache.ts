import { DocumentNode } from 'graphql';

import { getFragmentQueryDocument } from './fragment';

import {
  DataProxy,
  DataProxyReadQueryOptions,
  DataProxyReadFragmentOptions,
  DataProxyWriteQueryOptions,
  DataProxyWriteFragmentOptions,
} from './types';

export type CacheWrite = {
  dataId: string;
  result: any;
  document: DocumentNode;
  variables?: Object;
};

export abstract class Cache implements DataProxy {
  public abstract reset(): Promise<void>;

  public abstract diffQuery(query: {
    query: DocumentNode;
    variables: any;
    returnPartialData?: boolean;
    previousResult?: any;
    optimistic: boolean;
  }): any;

  public abstract read(query: {
    query: DocumentNode;
    variables: any;
    rootId?: string;
    previousResult?: any;
    optimistic: boolean;
  }): any;

  public readQuery<QueryType>(
    options: DataProxyReadQueryOptions,
    optimistic: boolean = false,
  ): QueryType {
    return this.read({
      query: options.query,
      variables: options.variables,
      optimistic,
    });
  }

  public readFragment<FragmentType>(
    options: DataProxyReadFragmentOptions,
    optimistic: boolean = false,
  ): FragmentType | null {
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

  public abstract writeResult(write: CacheWrite): void;

  public writeQuery(options: DataProxyWriteQueryOptions): void {
    this.writeResult({
      dataId: 'ROOT_QUERY',
      result: options.data,
      document: options.query,
      variables: options.variables,
    });
  }

  public writeFragment(options: DataProxyWriteFragmentOptions): void {
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

  public abstract removeOptimistic(id: string): void;
  public abstract getOptimisticData(): any;

  public abstract performTransaction(transaction: (c: Cache) => void): void;
  public abstract recordOptimisticTransaction(
    transaction: (c: Cache) => void,
    id: string,
  ): void;

  public abstract watch(
    query: {
      query: DocumentNode;
      variables: any;
      rootId?: string;
      previousResult?: any;
      optimistic: boolean;
    },
    callback: () => void,
  ): () => void;
}
