import { DocumentNode } from 'graphql';
import { ApolloStore, Store } from '../store';
import { DataWrite } from '../actions';
import { IdGetter } from '../core/types';
import { NormalizedCache } from '../data/storeUtils';
import { getFragmentQueryDocument } from '../queries/getFromAST';
import { getDataWithOptimisticResults } from '../optimistic-data/store';
import { readQueryFromStore } from './readFromStore';
import { writeResultToStore } from './writeToStore';

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
  readQuery<QueryType>(config: {
    query: DocumentNode,
    variables?: Object,
  }): QueryType;

  /**
   * Reads a GraphQL fragment from any arbitrary id. If there are more then
   * one fragments in the provided document then a `fragmentName` must be
   * provided to select the correct fragment.
   */
  readFragment<FragmentType>(config: {
    id: string,
    fragment: DocumentNode,
    fragmentName?: string,
    variables?: Object,
  }): FragmentType | null;

  /**
   * Writes a GraphQL query to the root query id.
   */
  writeQuery(config: {
    data: any,
    query: DocumentNode,
    variables?: Object,
  }): void;

  /**
   * Writes a GraphQL fragment to any arbitrary id. If there are more then
   * one fragments in the provided document then a `fragmentName` must be
   * provided to select the correct fragment.
   */
  writeFragment(config: {
    data: any,
    id: string,
    fragment: DocumentNode,
    fragmentName?: string,
    variables?: Object,
  }): void;
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
  public readQuery<QueryType>({
    query,
    variables,
  }: {
    query: DocumentNode,
    variables?: Object,
  }): QueryType {
    return readQueryFromStore<QueryType>({
      rootId: 'ROOT_QUERY',
      store: getDataWithOptimisticResults(this.reduxRootSelector(this.store.getState())),
      query,
      variables,
      returnPartialData: false,
    });
  }

  /**
   * Reads a fragment from the Redux state.
   */
  public readFragment<FragmentType>({
    id,
    fragment,
    fragmentName,
    variables,
  }: {
    id: string,
    fragment: DocumentNode,
    fragmentName?: string,
    variables?: Object,
  }): FragmentType | null {
    const query = getFragmentQueryDocument(fragment, fragmentName);
    const data = getDataWithOptimisticResults(this.reduxRootSelector(this.store.getState()));

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
  public writeQuery({
    data,
    query,
    variables,
  }: {
    data: any,
    query: DocumentNode,
    variables?: Object,
  }): void {
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
  public writeFragment({
    data,
    id,
    fragment,
    fragmentName,
    variables,
  }: {
    data: any,
    id: string,
    fragment: DocumentNode,
    fragmentName?: string,
    variables?: Object,
  }): void {
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

  /**
   * Gets a data id from an object. This is used when writing to our local
   * cache clone.
   */
  private dataIdFromObject: IdGetter;

  /**
   * An array of actions that we build up during the life of the transaction.
   * Once a transaction finishes the actions array will be returned.
   */
  private writes: Array<DataWrite>;

  /**
   * A boolean flag signaling if the transaction has finished or not.
   */
  private isFinished: boolean;

  constructor(data: NormalizedCache, dataIdFromObject: IdGetter = () => null) {
    this.data = { ...data };
    this.dataIdFromObject = dataIdFromObject;
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
   * Reads a query from the normalized cache.
   *
   * Throws an error if the transaction has finished.
   */
  public readQuery<QueryType>({
    query,
    variables,
  }: {
    query: DocumentNode,
    variables?: Object,
  }): QueryType {
    this.assertNotFinished();
    return readQueryFromStore<QueryType>({
      rootId: 'ROOT_QUERY',
      store: this.data,
      query,
      variables,
      returnPartialData: false,
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
  }: {
    id: string,
    fragment: DocumentNode,
    fragmentName?: string,
    variables?: Object,
  }): FragmentType | null {
    this.assertNotFinished();
    const { data } = this;
    const query = getFragmentQueryDocument(fragment, fragmentName);

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
   * Creates a write to be consumed after `finish` is called that instructs
   * a write to the store at the root query id. Cannot be called after
   * the transaction finishes.
   */
  public writeQuery({
    data,
    query,
    variables,
  }: {
    data: any,
    query: DocumentNode,
    variables?: Object,
  }): void {
    this.assertNotFinished();
    this.applyWrite({
      rootId: 'ROOT_QUERY',
      result: data,
      document: query,
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
  }: {
    data: any,
    id: string,
    fragment: DocumentNode,
    fragmentName?: string,
    variables?: Object,
  }): void {
    this.assertNotFinished();
    this.applyWrite({
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
      dataIdFromObject: this.dataIdFromObject,
    });
    this.writes.push(write);
  }
}
