import { DocumentNode } from 'graphql';
import { wrap } from 'optimism';

import { getFragmentQueryDocument } from '../../utilities/graphql/fragments';
import { DataProxy } from './types/DataProxy';
import { Cache } from './types/Cache';
import { queryFromPojo, fragmentFromPojo } from './utils';

const justTypenameQuery: DocumentNode = {
  kind: "Document",
  definitions: [{
    kind: "OperationDefinition",
    operation: "query",
    selectionSet: {
      kind: "SelectionSet",
      selections: [{
        kind: "Field",
        name: {
          kind: "Name",
          value: "__typename",
        },
      }],
    },
  }],
};

export type Transaction<T> = (c: ApolloCache<T>) => void;

export abstract class ApolloCache<TSerialized> implements DataProxy {
  // required to implement
  // core API
  public abstract read<T, TVariables = any>(
    query: Cache.ReadOptions<TVariables>,
  ): T | null;
  public abstract write<TResult = any, TVariables = any>(
    write: Cache.WriteOptions<TResult, TVariables>,
  ): void;
  public abstract diff<T>(query: Cache.DiffOptions): Cache.DiffResult<T>;
  public abstract watch(watch: Cache.WatchOptions): () => void;
  public abstract reset(): Promise<void>;

  // If called with only one argument, removes the entire entity
  // identified by dataId. If called with a fieldName as well, removes all
  // fields of the identified entity whose store names match fieldName.
  public abstract evict(dataId: string, fieldName?: string): boolean;

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
  public abstract removeOptimistic(id: string): void;

  // transactional API
  public abstract performTransaction(
    transaction: Transaction<TSerialized>,
  ): void;
  public abstract recordOptimisticTransaction(
    transaction: Transaction<TSerialized>,
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
  public readQuery<QueryType, TVariables = any>(
    options: DataProxy.Query<TVariables>,
    optimistic: boolean = false,
  ): QueryType | null {
    return this.read({
      query: options.query,
      variables: options.variables,
      optimistic,
    });
  }

  // Make sure we compute the same (===) fragment query document every
  // time we receive the same fragment in readFragment.
  private getFragmentDoc = wrap(getFragmentQueryDocument);

  public readFragment<FragmentType, TVariables = any>(
    options: DataProxy.Fragment<TVariables>,
    optimistic: boolean = false,
  ): FragmentType | null {
    return this.read({
      query: this.getFragmentDoc(options.fragment, options.fragmentName),
      variables: options.variables,
      rootId: options.id,
      optimistic,
    });
  }

  public writeQuery<TData = any, TVariables = any>(
    options: Cache.WriteQueryOptions<TData, TVariables>,
  ): void {
    this.write({
      dataId: 'ROOT_QUERY',
      result: options.data,
      query: options.query,
      variables: options.variables,
    });
  }

  public writeFragment<TData = any, TVariables = any>(
    options: Cache.WriteFragmentOptions<TData, TVariables>,
  ): void {
    this.write({
      dataId: options.id,
      result: options.data,
      variables: options.variables,
      query: this.getFragmentDoc(options.fragment, options.fragmentName),
    });
  }

  public writeData<TData = any>({
    id,
    data,
  }: Cache.WriteDataOptions<TData>): void {
    if (typeof id !== 'undefined') {
      let typenameResult = null;
      // Since we can't use fragments without having a typename in the store,
      // we need to make sure we have one.
      // To avoid overwriting an existing typename, we need to read it out first
      // and generate a fake one if none exists.
      try {
        typenameResult = this.read<any>({
          rootId: id,
          optimistic: false,
          query: justTypenameQuery,
        });
      } catch (e) {
        // Do nothing, since an error just means no typename exists
      }

      // tslint:disable-next-line
      const __typename =
        (typenameResult && typenameResult.__typename) || '__ClientData';

      // Add a type here to satisfy the inmemory cache
      const dataToWrite = Object.assign({ __typename }, data);

      this.writeFragment({
        id,
        fragment: fragmentFromPojo(dataToWrite, __typename),
        data: dataToWrite,
      });
    } else {
      this.writeQuery({ query: queryFromPojo(data), data });
    }
  }
}
