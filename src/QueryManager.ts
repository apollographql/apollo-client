import {
  NetworkInterface,
  Request,
} from './networkInterface';

import {
  parseQuery,
  parseMutation,
} from './parser';

import {
  assign,
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
  GraphQLError,
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

  private resultCallbacks: { [queryId: number]: QueryResultCallback[] };

  private idCounter = 0;

  constructor({
    networkInterface,
    store,
  }: {
    networkInterface: NetworkInterface,
    store: ApolloStore,
  }) {
    // XXX this might be the place to do introspection for inserting the `id` into the query? or
    // is that the network interface?
    this.networkInterface = networkInterface;
    this.store = store;

    this.resultCallbacks = {};

    this.store.subscribe(() => {
      this.broadcastNewStore(this.store.getState());
    });
  }

  public mutate({
    mutation,
    variables,
  }: {
    mutation: string,
    variables?: Object,
  }): Promise<GraphQLResult> {
    throw new Error('not implemented lol');
    // const mutationDef = parseMutation(mutation);

    // const request = {
    //   query: mutation,
    //   variables,
    // } as Request;

    // return this.networkInterface.query(request)
    //   .then((result) => {
    //     this.store.dispatch({
    //       type: 'QUERY_RESULT',
    //       result,
    //       variables,
    //     });

    //     return result;
    //   });
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

    this.resultCallbacks[queryId] = [];

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
        store: this.store.getState().data,
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
            variables,
            query: minimizedQuery,
            queryId,
          });
        }).catch((error: Error) => {
           // XXX handle errors
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
          complete: ! minimizedQuery,
          queryId,
        });
      });
    }

    return this.watchQueryInStore(queryId);
  }

  public broadcastNewStore(store: Store) {
    forOwn(store.queries, (queryStoreValue: QueryStoreValue, queryId: string) => {
      // XXX check loading state, error, and returnPartialData
      this.broadcastQueryChange(queryId, queryStoreValue.result);
    });
  }

  public watchQueryInStore(queryId: string): WatchedQueryHandle {
    const isStopped = () => {
      return !this.store.getState().queries[queryId];
    };

    return {
      id: queryId,
      isStopped,
      stop: () => {
        this.stopQuery(queryId);
      },
      onResult: (callback) => {
        if (isStopped()) { throw new Error('Query was stopped. Please create a new one.'); }

        this.registerResultCallback(queryId, callback);
      },
    };
  }

  private stopQuery(queryId) {
    delete this.resultCallbacks[queryId];
  }

  private broadcastQueryChange(queryId: string, result: GraphQLResult) {
    this.resultCallbacks[queryId].forEach((callback) => {
      callback(result);
    });
  }

  private registerResultCallback(queryId: string, callback: QueryResultCallback): void {
    this.resultCallbacks[queryId].push(callback);
  }
}

export interface WatchedQueryHandle {
  id: string;
  isStopped: () => boolean;
  stop();
  onResult(callback: QueryResultCallback);
}

export type QueryResultCallback = (result: GraphQLResult) => void;

export interface WatchQueryOptions {
  query: string;
  variables?: Object;
  forceFetch?: boolean;
  returnPartialData?: boolean;
}
