import { DocumentNode } from 'graphql';
import { ApolloStore, Store, ApolloReducerConfig } from '../store';
import { DataStore } from '../data/store';
import { DataWrite } from '../actions';
import { IdGetter } from '../core/types';
import { NormalizedCache } from '../data/storeUtils';
import {
  getFragmentQueryDocument,
  getOperationName,
} from '../queries/getFromAST';
import { readQueryFromStore } from './readFromStore';
import { writeResultToStore } from './writeToStore';
import { FragmentMatcherInterface } from './fragmentMatcher';
import { addTypenameToDocument } from '../queries/queryTransform';
import { QueryManager } from '../core/QueryManager';

export interface DataProxyReadQueryOptions {
  /**
   * The GraphQL query shape to be used constructed using the `gql` template
   * string tag from `graphql-tag`. The query will be used to determine the
   * shape of the data to be read.
   */
  query: DocumentNode;

  /**
   * Any variables that the GraphQL query may depend on.
   */
  variables?: Object;
}

export interface DataProxyReadFragmentOptions {
  /**
   * The root id to be used. This id should take the same form as the
   * value returned by your `dataIdFromObject` function. If a value with your
   * id does not exist in the store, `null` will be returned.
   */
  id: string;

  /**
   * A GraphQL document created using the `gql` template string tag from
   * `graphql-tag` with one or more fragments which will be used to determine
   * the shape of data to read. If you provide more then one fragment in this
   * document then you must also specify `fragmentName` to select a single.
   */
  fragment: DocumentNode;

  /**
   * The name of the fragment in your GraphQL document to be used. If you do
   * not provide a `fragmentName` and there is only one fragment in your
   * `fragment` document then that fragment will be used.
   */
  fragmentName?: string;

  /**
   * Any variables that your GraphQL fragments depend on.
   */
  variables?: Object;
}

export interface DataProxyWriteQueryOptions {
  /**
   * The data you will be writing to the store.
   */
  data: any;

  /**
   * The GraphQL query shape to be used constructed using the `gql` template
   * string tag from `graphql-tag`. The query will be used to determine the
   * shape of the data to be written.
   */
  query: DocumentNode;

  /**
   * Any variables that the GraphQL query may depend on.
   */
  variables?: Object;
}

export interface DataProxyWriteFragmentOptions {
  /**
   * The data you will be writing to the store.
   */
  data: any;

  /**
   * The root id to be used. This id should take the same form as the  value
   * returned by your `dataIdFromObject` function.
   */
  id: string;

  /**
   * A GraphQL document created using the `gql` template string tag from
   * `graphql-tag` with one or more fragments which will be used to determine
   * the shape of data to write. If you provide more then one fragment in this
   * document then you must also specify `fragmentName` to select a single.
   */
  fragment: DocumentNode;

  /**
   * The name of the fragment in your GraphQL document to be used. If you do
   * not provide a `fragmentName` and there is only one fragment in your
   * `fragment` document then that fragment will be used.
   */
  fragmentName?: string;

  /**
   * Any variables that your GraphQL fragments depend on.
   */
  variables?: Object;
}

/**
 * A proxy to the normalized data living in our store. This interface allows a
 * user to read and write denormalized data which feels natural to the user
 * whilst in the background this data is being converted into the normalized
 * store format.
 */
export interface DataProxy {
  /**
   * Reads a GraphQL query from the root query id.
   */
  readQuery<QueryType>(options: DataProxyReadQueryOptions): QueryType;

  /**
   * Reads a GraphQL fragment from any arbitrary id. If there are more then
   * one fragments in the provided document then a `fragmentName` must be
   * provided to select the correct fragment.
   */
  readFragment<FragmentType>(
    options: DataProxyReadFragmentOptions,
  ): FragmentType | null;

  /**
   * Writes a GraphQL query to the root query id.
   */
  writeQuery(options: DataProxyWriteQueryOptions): void;

  /**
   * Writes a GraphQL fragment to any arbitrary id. If there are more then
   * one fragments in the provided document then a `fragmentName` must be
   * provided to select the correct fragment.
   */
  writeFragment(options: DataProxyWriteFragmentOptions): void;
}

/**
 * A data proxy powered by our internal implementation of the data store,
 * which tracks the normalized cache and optimistic query status.
 */
export class StoreDataProxy implements DataProxy {
  /**
   * The internal store containing the normalized cache and optimistic results state.
   */
  private store: DataStore;

  private reduxStore: ApolloStore;

  private reducerConfig: ApolloReducerConfig;

  private fragmentMatcher: FragmentMatcherInterface;

  constructor(
    store: DataStore,
    fragmentMatcher: FragmentMatcherInterface,
    reducerConfig: ApolloReducerConfig,
    reduxStore?: ApolloStore,
  ) {
    this.store = store;
    this.reducerConfig = reducerConfig;
    this.fragmentMatcher = fragmentMatcher;

    if (reduxStore) {
      this.reduxStore = reduxStore;
    }
  }

  /**
   * Reads a query from the data store.
   */
  public readQuery<QueryType>({
    query,
    variables,
  }: DataProxyReadQueryOptions): QueryType {
    if (this.reducerConfig.addTypename) {
      query = addTypenameToDocument(query);
    }

    return readQueryFromStore<QueryType>({
      rootId: 'ROOT_QUERY',
      store: this.store.getDataWithOptimisticResults(),
      query,
      variables,
      fragmentMatcherFunction: this.fragmentMatcher.match,
      config: this.reducerConfig,
    });
  }

  /**
   * Reads a fragment from the data store.
   */
  public readFragment<FragmentType>({
    id,
    fragment,
    fragmentName,
    variables,
  }: DataProxyReadFragmentOptions): FragmentType | null {
    let query = getFragmentQueryDocument(fragment, fragmentName);
    const data = this.store.getDataWithOptimisticResults();

    // If we could not find an item in the store with the provided id then we
    // just return `null`.
    if (typeof data[id] === 'undefined') {
      return null;
    }

    if (this.reducerConfig.addTypename) {
      query = addTypenameToDocument(query);
    }

    return readQueryFromStore<FragmentType>({
      rootId: id,
      store: data,
      query,
      variables,
      fragmentMatcherFunction: this.fragmentMatcher.match,
      config: this.reducerConfig,
    });
  }

  /**
   * Writes a query to the data store.
   */
  public writeQuery({
    data,
    query,
    variables,
  }: DataProxyWriteQueryOptions): void {
    if (this.reducerConfig.addTypename) {
      query = addTypenameToDocument(query);
    }

    if (QueryManager.EMIT_REDUX_ACTIONS) {
      this.reduxStore.dispatch({
        type: 'APOLLO_WRITE',
        writes: [
          {
            rootId: 'ROOT_QUERY',
            result: data,
            document: query,
            operationName: getOperationName(query),
            variables: variables || {},
          },
        ],
      });
    }

    this.store.executeWrites([
      {
        rootId: 'ROOT_QUERY',
        result: data,
        document: query,
        operationName: getOperationName(query),
        variables: variables || {},
      },
    ]);
  }

  /**
   * Writes a fragment to the data store.
   */
  public writeFragment({
    data,
    id,
    fragment,
    fragmentName,
    variables,
  }: DataProxyWriteFragmentOptions): void {
    let document = getFragmentQueryDocument(fragment, fragmentName);

    if (this.reducerConfig.addTypename) {
      document = addTypenameToDocument(document);
    }

    if (QueryManager.EMIT_REDUX_ACTIONS) {
      this.reduxStore.dispatch({
        type: 'APOLLO_WRITE',
        writes: [
          {
            rootId: id,
            result: data,
            document,
            operationName: getOperationName(document),
            variables: variables || {},
          },
        ],
      });
    }

    this.store.executeWrites([
      {
        rootId: id,
        result: data,
        document,
        operationName: getOperationName(document),
        variables: variables || {},
      },
    ]);
  }
}

/**
 * A data proxy to be used within a transaction. It saves all writes to be
 * returned when the transaction finishes. As soon as a transaction is
 * constructed it has started. Once a transaction has finished none of its
 * methods are usable.
 *
 * The transaction will read from a single local normalized cache instance and
 * it will write to that cache instance as well.
 */
export class TransactionDataProxy implements DataProxy {
  /**
   * The normalized cache that this transaction reads from. This object will be
   * a shallow clone of the `data` object passed into the constructor.
   */
  private data: NormalizedCache;

  private reducerConfig: ApolloReducerConfig;

  /**
   * An array of actions that we build up during the life of the transaction.
   * Once a transaction finishes the actions array will be returned.
   */
  private writes: Array<DataWrite>;

  /**
   * A boolean flag signaling if the transaction has finished or not.
   */
  private isFinished: boolean;

  constructor(data: NormalizedCache, reducerConfig: ApolloReducerConfig) {
    this.data = { ...data };
    this.reducerConfig = reducerConfig;
    this.writes = [];
    this.isFinished = false;
  }

  /**
   * Finishes a transaction and returns the actions accumulated during this
   * transaction.
   */
  public finish(): Array<DataWrite> {
    this.assertNotFinished();
    const writes = this.writes;
    this.writes = [];
    this.isFinished = true;
    return writes;
  }

  /**
   * Reads a query from the normalized cache.
   *
   * Throws an error if the transaction has finished.
   */
  public readQuery<QueryType>({
    query,
    variables,
  }: DataProxyReadQueryOptions): QueryType {
    this.assertNotFinished();

    if (this.reducerConfig.addTypename) {
      query = addTypenameToDocument(query);
    }

    return readQueryFromStore<QueryType>({
      rootId: 'ROOT_QUERY',
      store: this.data,
      query,
      variables,
      config: this.reducerConfig,
      fragmentMatcherFunction: this.reducerConfig.fragmentMatcher,
    });
  }

  /**
   * Reads a fragment from the normalized cache.
   *
   * Throws an error if the transaction has finished.
   */
  public readFragment<FragmentType>({
    id,
    fragment,
    fragmentName,
    variables,
  }: DataProxyReadFragmentOptions): FragmentType | null {
    this.assertNotFinished();

    if (!fragment) {
      throw new Error(
        'fragment option is required. Please pass a GraphQL fragment to readFragment.',
      );
    }

    const { data } = this;
    let query = getFragmentQueryDocument(fragment, fragmentName);

    if (this.reducerConfig.addTypename) {
      query = addTypenameToDocument(query);
    }

    // If we could not find an item in the store with the provided id then we
    // just return `null`.
    if (typeof data[id] === 'undefined') {
      return null;
    }

    return readQueryFromStore<FragmentType>({
      rootId: id,
      store: data,
      query,
      variables,
      config: this.reducerConfig,
      fragmentMatcherFunction: this.reducerConfig.fragmentMatcher,
    });
  }

  /**
   * Creates a write to be consumed after `finish` is called that instructs
   * a write to the store at the root query id. Cannot be called after
   * the transaction finishes.
   */
  public writeQuery({
    data,
    query,
    variables,
  }: DataProxyWriteQueryOptions): void {
    this.assertNotFinished();

    if (this.reducerConfig.addTypename) {
      query = addTypenameToDocument(query);
    }

    this.applyWrite({
      rootId: 'ROOT_QUERY',
      result: data,
      document: query,
      operationName: getOperationName(query),
      variables: variables || {},
    });
  }

  /**
   * Creates a write to be consumed after `finish` is called that instructs a
   * write to the store form some fragment data at an arbitrary id. Cannot be
   * called after the transaction finishes.
   */
  public writeFragment({
    data,
    id,
    fragment,
    fragmentName,
    variables,
  }: DataProxyWriteFragmentOptions): void {
    this.assertNotFinished();

    if (!fragment) {
      throw new Error(
        'fragment option is required. Please pass a GraphQL fragment to writeFragment.',
      );
    }

    let query = getFragmentQueryDocument(fragment, fragmentName);

    if (this.reducerConfig.addTypename) {
      query = addTypenameToDocument(query);
    }

    this.applyWrite({
      rootId: id,
      result: data,
      document: query,
      operationName: getOperationName(query),
      variables: variables || {},
    });
  }

  /**
   * Throws an error if the transaction has finished. All methods in the
   * transaction data proxy should use this method.
   */
  private assertNotFinished() {
    if (this.isFinished) {
      throw new Error(
        'Cannot call transaction methods after the transaction has finished.',
      );
    }
  }

  /**
   * Takes a write and applies it to our local cache, and adds it to a writes
   * array which will be returned later on when the transaction finishes.
   */
  private applyWrite(write: DataWrite) {
    writeResultToStore({
      result: write.result,
      dataId: write.rootId,
      document: write.document,
      variables: write.variables,
      store: this.data,
      dataIdFromObject: this.reducerConfig.dataIdFromObject || (() => null),
      fragmentMatcherFunction: this.reducerConfig.fragmentMatcher,
    });
    this.writes.push(write);
  }
}
