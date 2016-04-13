import {
  NetworkInterface,
  Request,
} from './networkInterface';

import {
  parseQuery,
  parseMutation,
} from './parser';

import {
  forOwn,
} from 'lodash';

import {
  Store,
  ApolloStore,
} from './store';

import {
  SelectionSetWithRoot,
  QueryStoreValue,
} from './queries/store';

import {
  GraphQLResult,
} from 'graphql';

import {
  readSelectionSetFromStore,
} from './data/readFromStore';

import {
  diffSelectionSetAgainstStore,
} from './data/diffAgainstStore';

import {
  queryDefinition,
  printQueryFromDefinition,
} from './queryPrinting';

export class QueryManager {
  private networkInterface: NetworkInterface;
  private store: ApolloStore;
  private reduxRootKey: string;

  private observers: { [queryId: number]: QueryObserver[] };

  private idCounter = 0;

  constructor({
    networkInterface,
    store,
    reduxRootKey,
  }: {
    networkInterface: NetworkInterface,
    store: ApolloStore,
    reduxRootKey: string,
  }) {
    // XXX this might be the place to do introspection for inserting the `id` into the query? or
    // is that the network interface?
    this.networkInterface = networkInterface;
    this.store = store;
    this.reduxRootKey = reduxRootKey;

    this.observers = {};

    // this.store is usually the fake store we get from the Redux middleware API
    // XXX for tests, we sometimes pass in a real Redux store into the QueryManager
    if (this.store['subscribe']) {
      this.store['subscribe'](() => {
        this.broadcastNewStore(this.store.getState());
      });
    }
  }

  public mutate({
    mutation,
    variables,
  }: {
    mutation: string,
    variables?: Object,
  }): Promise<GraphQLResult> {
    // Generate a query ID
    const mutationId = this.idCounter.toString();
    this.idCounter++;

    const mutationDef = parseMutation(mutation);

    const request = {
      query: mutation,
      variables,
    } as Request;

    this.store.dispatch({
      type: 'MUTATION_INIT',
      mutationString: mutation,
      mutation: {
        id: 'ROOT_MUTATION',
        typeName: 'Mutation',
        selectionSet: mutationDef.selectionSet,
      },
      variables,
      mutationId,
    });

    return this.networkInterface.query(request)
      .then((result) => {
        this.store.dispatch({
          type: 'MUTATION_RESULT',
          result,
          mutationId,
        });

        return result;
      });
  }

  public watchQuery({
    query,
    variables,
    forceFetch = true,
    returnPartialData = false,
  }: WatchQueryOptions): WatchedQueryHandle {
    // Generate a query ID
    const queryId = this.idCounter.toString();
    this.idCounter++;


    this.observers[queryId] = [];

    const queryString = query;

    // Parse the query passed in -- this could also be done by a build plugin or tagged
    // template string
    const querySS = {
      id: 'ROOT_QUERY',
      typeName: 'Query',
      selectionSet: parseQuery(query).selectionSet,
    } as SelectionSetWithRoot;

    // If we don't use diffing, then these will be the same as the original query
    let minimizedQueryString = query;
    let minimizedQuery = querySS;

    let initialResult;

    if (!forceFetch) {
      // If the developer has specified they want to use the existing data in the store for this
      // query, use the query diff algorithm to get as much of a result as we can, and identify
      // what data is missing from the store
      const { missingSelectionSets, result } = diffSelectionSetAgainstStore({
        selectionSet: querySS.selectionSet,
        store: this.store.getState()[this.reduxRootKey].data,
        throwOnMissingField: false,
        rootId: querySS.id,
        variables,
      });

      initialResult = result;

      if (missingSelectionSets.length) {
        const diffedQueryDef = queryDefinition(missingSelectionSets);

        minimizedQuery = {
          id: 'ROOT_QUERY',
          typeName: 'Query',
          selectionSet: diffedQueryDef.selectionSet,
        };

        minimizedQueryString = printQueryFromDefinition(diffedQueryDef);
      } else {
        minimizedQuery = null;
        minimizedQueryString = null;
      }
    }

    // Initialize query in store
    this.store.dispatch({
      type: 'QUERY_INIT',
      queryString,
      query: querySS,
      minimizedQueryString,
      minimizedQuery,
      variables,
      forceFetch,
      returnPartialData,
      queryId,
    });

    if (minimizedQuery) {
      const request: Request = {
        query: minimizedQueryString,
        variables,
      };

      this.networkInterface.query(request)
        .then((result: GraphQLResult) => {
          // XXX handle multiple GraphQLResults
          this.store.dispatch({
            type: 'QUERY_RESULT',
            result,
            queryId,
          });
        }).catch((error: Error) => {
          this.broadcastQueryError(queryId, error);
        });
    }

    if (! minimizedQuery || returnPartialData) {
      setTimeout(() => {
        // Make this async so that we have time to add a callback
        this.store.dispatch({
          type: 'QUERY_RESULT_CLIENT',
          result: {
            data: initialResult,
          },
          variables,
          query: querySS,
          complete: !! minimizedQuery,
          queryId,
        });
      }, 0);
    }

    return this.watchQueryInStore(queryId);
  }

  public broadcastNewStore(store: any) {
    const apolloStore: Store = store[this.reduxRootKey];

    forOwn(apolloStore.queries, (queryStoreValue: QueryStoreValue, queryId: string) => {
      // XXX We also need to check for network errors and returnPartialData
      if (!queryStoreValue.loading) {
        // XXX Currently, returning errors and data is exclusive because we
        // don't handle partial results
        if (queryStoreValue.graphQLErrors) {
          this.broadcastQueryChange(queryId, {
            errors: queryStoreValue.graphQLErrors,
          });
        } else {
          const resultFromStore = readSelectionSetFromStore({
            store: apolloStore.data,
            rootId: queryStoreValue.query.id,
            selectionSet: queryStoreValue.query.selectionSet,
            variables: queryStoreValue.variables,
          });

          this.broadcastQueryChange(queryId, {
            data: resultFromStore,
          });
        }
      }
    });
  }

  public watchQueryInStore(queryId: string): WatchedQueryHandle {
    const isStopped = () => {
      return !this.store.getState()[this.reduxRootKey].queries[queryId];
    };

    return {
      id: queryId,
      isStopped,
      stop: () => {
        this.stopQuery(queryId);
      },
      subscribe: (observer: QueryObserver) => {
        if (isStopped()) { throw new Error('Query was stopped. Please create a new one.'); }

        this.registerObserver(queryId, observer);
      },
      onResult: (callback) => {
        if (isStopped()) { throw new Error('Query was stopped. Please create a new one.'); }

        const observer = {
          onResult: callback,
          onError: () => { return; },
        };

        this.registerObserver(queryId, observer);
      },
    };
  }

  private stopQuery(queryId) {
    this.store.dispatch({
      type: 'QUERY_STOP',
      queryId,
    });

    delete this.observers[queryId];
  }

  private broadcastQueryChange(queryId: string, result: GraphQLResult) {
    this.observers[queryId].forEach((observer) => {
      observer.onResult(result);
    });
  }

  private broadcastQueryError(queryId: string, error: Error) {
    this.observers[queryId].forEach((observer) => {
      observer.onError(error);
    });
  }

  private registerObserver(queryId: string, observer: QueryObserver): void {
    this.observers[queryId].push(observer);
  }
}

export interface WatchedQueryHandle {
  id: string;
  isStopped: () => boolean;
  stop();
  subscribe(observer: QueryObserver);
  onResult(callback: QueryResultCallback);
}

export type QueryResultCallback = (result: GraphQLResult) => void;

export interface QueryObserver {
  onResult: (result: GraphQLResult) => void;
  onError: (error: Error) => void;
  onStop?: () => void;
}

export interface WatchQueryOptions {
  query: string;
  variables?: Object;
  forceFetch?: boolean;
  returnPartialData?: boolean;
}
