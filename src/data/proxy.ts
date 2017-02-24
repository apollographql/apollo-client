import { DocumentNode } from 'graphql';
import { ApolloStore, Store } from '../store';
import { DataWrite } from '../actions';
import { getFragmentQueryDocument } from '../queries/getFromAST';
import { readQueryFromStore } from './readFromStore';

/**
 * A proxy to the normalized data living in our store. This interface allows a
 * user to read and write denormalized data which feels natural to the user
 * whilst in the background this data is being converted into the normalized
 * store format.
 */
export interface DataProxy extends DataProxyRead, DataProxyWrite {}

/**
 * A subset of the methods on `DataProxy` which just involve the methods for
 * reading some data. These methods will not change any data.
 */
export interface DataProxyRead {
  /**
   * Reads a GraphQL query from the root query id.
   */
  readQuery<QueryType>(
    query: DocumentNode,
    variables?: Object,
  ): QueryType;

  /**
   * Reads a GraphQL fragment from any arbitrary id. If there are more then
   * one fragments in the provided document then a `fragmentName` must be
   * provided to select the correct fragment.
   */
  readFragment<FragmentType>(
    id: string,
    fragment: DocumentNode,
    fragmentName?: string,
    variables?: Object,
  ): FragmentType | null;
}

/**
 * A subset of the methods on `DataProxy` which just involve the methods for
 * writing some data. These methods *will* change the underlying data
 * representation. How and when that change happens is up to the implementor,
 * but the expectation is that calling these methods will eventually change
 * some data.
 */
export interface DataProxyWrite {
  /**
   * Writes a GraphQL query to the root query id.
   */
  writeQuery(
    data: any,
    query: DocumentNode,
    variables?: Object,
  ): void;

  /**
   * Writes a GraphQL fragment to any arbitrary id. If there are more then
   * one fragments in the provided document then a `fragmentName` must be
   * provided to select the correct fragment.
   */
  writeFragment(
    data: any,
    id: string,
    fragment: DocumentNode,
    fragmentName?: string,
    variables?: Object,
  ): void;
}

/**
 * A data proxy that is completely powered by our Redux store. Reads are read
 * from the Redux state and writes are dispatched using actions where they will
 * update the store.
 *
 * Needs a Redux store and a selector function to get the Apollo state from the
 * root Redux state.
 */
export class ReduxDataProxy implements DataProxy {
  /**
   * The Redux store that we read and write to.
   */
  private store: ApolloStore;

  /**
   * A function that selects the Apollo state from Redux state.
   */
  private reduxRootSelector: (state: any) => Store;

  constructor(
    store: ApolloStore,
    reduxRootSelector: (state: any) => Store,
  ) {
    this.store = store;
    this.reduxRootSelector = reduxRootSelector;
  }

  /**
   * Reads a query from the Redux state.
   */
  public readQuery<QueryType>(
    query: DocumentNode,
    variables?: Object,
  ): QueryType {
    return readQueryFromStore<QueryType>({
      rootId: 'ROOT_QUERY',
      store: this.reduxRootSelector(this.store.getState()).data,
      query,
      variables,
      returnPartialData: false,
    });
  }

  /**
   * Reads a fragment from the Redux state.
   */
  public readFragment<FragmentType>(
    id: string,
    fragment: DocumentNode,
    fragmentName?: string,
    variables?: Object,
  ): FragmentType | null {
    const query = getFragmentQueryDocument(fragment, fragmentName);
    const { data } = this.reduxRootSelector(this.store.getState());

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
      returnPartialData: false,
    });
  }

  /**
   * Writes a query to the Redux state.
   */
  public writeQuery(
    data: any,
    query: DocumentNode,
    variables?: Object,
  ): void {
    this.store.dispatch({
      type: 'APOLLO_WRITE',
      writes: [{
        rootId: 'ROOT_QUERY',
        result: data,
        document: query,
        variables: variables || {},
      }],
    });
  }

  /**
   * Writes a fragment to the Redux state.
   */
  public writeFragment(
    data: any,
    id: string,
    fragment: DocumentNode,
    fragmentName?: string,
    variables?: Object,
  ): void {
    this.store.dispatch({
      type: 'APOLLO_WRITE',
      writes: [{
        rootId: id,
        result: data,
        document: getFragmentQueryDocument(fragment, fragmentName),
        variables: variables || {},
      }],
    });
  }
}

/**
 * A data proxy to be used within a transaction. It uses another data proxy for
 * reads and pushes all writes to an actions array which can be retrieved when
 * the transaction finishes. As soon as a transaction is constructed it has
 * started. Once a transaction has finished none of its methods are usable.
 */
export class TransactionDataProxy implements DataProxy {
  /**
   * The proxy to use for reading. The reason a transaction data proxy is not
   * just a write proxy is that we want to throw errors if a transaction has
   * finished and a user is trying to read.
   */
  private proxy: DataProxyRead;

  /**
   * An array of actions that we build up during the life of the transaction.
   * Once a transaction finishes the actions array will be returned.
   */
  private writes: Array<DataWrite>;

  /**
   * A boolean flag signaling if the transaction has finished or not.
   */
  private isFinished: boolean;

  constructor(proxy: DataProxyRead) {
    this.proxy = proxy;
    this.writes = [];
    this.isFinished = false;
  }

  /**
   * Finishes a transaction and returns the actions accumulated during this
   * transaction. The actions are not ready for dispatch in Redux, however. The
   * `type` must be added before that.
   */
  public finish(): Array<DataWrite> {
    this.assertNotFinished();
    const writes = this.writes;
    this.writes = [];
    this.isFinished = true;
    return writes;
  }

  /**
   * Reads some data from the store from the root query id. Cannot be called
   * after the transaction finishes.
   */
  public readQuery<QueryType>(
    query: DocumentNode,
    variables?: Object,
  ): QueryType {
    this.assertNotFinished();
    return this.proxy.readQuery<QueryType>(query, variables);
  }

  /**
   * Reads a fragment from the store at an arbitrary id. Cannot be called after
   * the transaction finishes.
   */
  public readFragment<FragmentType>(
    id: string,
    fragment: DocumentNode,
    fragmentName?: string,
    variables?: Object,
  ): FragmentType | null {
    this.assertNotFinished();
    return this.proxy.readFragment<FragmentType>(id, fragment, fragmentName, variables);
  }

  /**
   * Creates an action to be consumed after `finish` is called that writes
   * some query data to the store at the root query id. Cannot be called after
   * the transaction finishes.
   */
  public writeQuery(
    data: any,
    query: DocumentNode,
    variables?: Object,
  ): void {
    this.assertNotFinished();
    this.writes.push({
      rootId: 'ROOT_QUERY',
      result: data,
      document: query,
      variables: variables || {},
    });
  }

  /**
   * Creates an action to be consumed after `finish` is called that writes some
   * fragment data to the store at an arbitrary id. Cannot be called after the
   * transaction finishes.
   */
  public writeFragment(
    data: any,
    id: string,
    fragment: DocumentNode,
    fragmentName?: string,
    variables?: Object,
  ): void {
    this.assertNotFinished();
    this.writes.push({
      rootId: id,
      result: data,
      document: getFragmentQueryDocument(fragment, fragmentName),
      variables: variables || {},
    });
  }

  /**
   * Throws an error if the transaction has finished. All methods in the
   * transaction data proxy should use this method.
   */
  private assertNotFinished() {
    if (this.isFinished) {
      throw new Error('Cannot call transaction methods after the transaction has finished.');
    }
  }
}
