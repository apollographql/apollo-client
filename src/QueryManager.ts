import {
  NetworkInterface,
  Request,
} from './networkInterface';

import forOwn = require('lodash.forown');
import assign = require('lodash.assign');

import {
  ApolloStore,
  Store,
} from './store';

import {
  SelectionSetWithRoot,
  QueryStoreValue,
} from './queries/store';

import {
  getMutationDefinition,
  getQueryDefinition,
} from './queries/getFromAST';

import {
  GraphQLResult,
  Document,
} from 'graphql';

import { print } from 'graphql/language/printer';

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

import { Observable, Observer, Subscription } from './util/Observable';

export class ObservableQuery extends Observable<GraphQLResult> {
  public subscribe(observer: Observer<GraphQLResult>): QuerySubscription {
    return super.subscribe(observer) as QuerySubscription;
  }

  public result(): Promise<GraphQLResult> {
    return new Promise((resolve, reject) => {
      const subscription = this.subscribe({
        next(result) {
          resolve(result);
          setTimeout(() => {
            subscription.unsubscribe();
          }, 0);
        },
        error(error) {
          reject(error);
        },
      });
    });
  }
}

export interface QuerySubscription extends Subscription {
  refetch(variables?: any): Promise<GraphQLResult>;
  stopPolling(): void;
  startPolling(pollInterval: number): void;
}

export interface WatchQueryOptions {
  query: Document;
  variables?: { [key: string]: any };
  forceFetch?: boolean;
  returnPartialData?: boolean;
  pollInterval?: number;
}

type QueryListener = (queryStoreValue: QueryStoreValue) => void

export class QueryManager {
  private networkInterface: NetworkInterface;
  private store: ApolloStore;
  private reduxRootKey: string;
  private pollingTimer: NodeJS.Timer | any; // oddity in typescript

  private queryListeners: { [queryId: string]: QueryListener };

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

    this.queryListeners = {};

    // this.store is usually the fake store we get from the Redux middleware API
    // XXX for tests, we sometimes pass in a real Redux store into the QueryManager
    if (this.store['subscribe']) {
      this.store['subscribe'](() => {
        this.broadcastQueries();
      });
    }
  }

  // Called from middleware
  public broadcastNewStore(store: any) {
    this.broadcastQueries();
  }

  public mutate({
    mutation,
    variables,
  }: {
    mutation: Document,
    variables?: Object,
  }): Promise<GraphQLResult> {
    const mutationId = this.generateQueryId();

    const mutationDef = getMutationDefinition(mutation);
    const mutationString = print(mutation);

    const request = {
      query: mutationString,
      variables,
    } as Request;

    this.store.dispatch({
      type: 'APOLLO_MUTATION_INIT',
      mutationString,
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
          type: 'APOLLO_MUTATION_RESULT',
          result,
          mutationId,
        });

        return result;
      });
  }

  public watchQuery(options: WatchQueryOptions): ObservableQuery {
    // Call just to get errors synchronously
    getQueryDefinition(options.query);

    return new ObservableQuery((observer) => {
      const queryId = this.startQuery(options, (queryStoreValue: QueryStoreValue) => {
        if (!queryStoreValue.loading || queryStoreValue.returnPartialData) {
          // XXX Currently, returning errors and data is exclusive because we
          // don't handle partial results
          if (queryStoreValue.graphQLErrors) {
            if (observer.next) {
              observer.next({ errors: queryStoreValue.graphQLErrors });
            }
          } else if (queryStoreValue.networkError) {
            // XXX we might not want to re-broadcast the same error over and over if it didn't change
            if (observer.error) {
              observer.error(queryStoreValue.networkError);
            } else {
              console.error('Unhandled network error',
                queryStoreValue.networkError,
                queryStoreValue.networkError.stack);
            }
          } else {
            const resultFromStore = readSelectionSetFromStore({
              store: this.getApolloState().data,
              rootId: queryStoreValue.query.id,
              selectionSet: queryStoreValue.query.selectionSet,
              variables: queryStoreValue.variables,
              returnPartialData: options.returnPartialData,
            });

            if (observer.next) {
              observer.next({ data: resultFromStore });
            }
          }
        }
      });

      return {
        unsubscribe: () => {
          this.stopQuery(queryId);
        },
        refetch: (variables: any): Promise<GraphQLResult> => {
          // if we are refetching, we clear out the polling interval
          // if the new refetch passes pollInterval: false, it won't recreate
          // the timer for subsequent refetches
          if (this.pollingTimer) {
            clearInterval(this.pollingTimer);
          }

          // If no new variables passed, use existing variables
          variables = variables || options.variables;

          // Use the same options as before, but with new variables and forceFetch true
          return this.fetchQuery(queryId, assign(options, {
            forceFetch: true,
            variables,
          }) as WatchQueryOptions);
        },
        stopPolling: (): void => {
          if (this.pollingTimer) {
            clearInterval(this.pollingTimer);
          }
        },
        startPolling: (pollInterval): void => {
          this.pollingTimer = setInterval(() => {
            const pollingOptions = assign({}, options) as WatchQueryOptions;
            // subsequent fetches from polling always reqeust new data
            pollingOptions.forceFetch = true;
            this.fetchQuery(queryId, pollingOptions);
          }, pollInterval);
        },
      };
    });
  }

  public query(options: WatchQueryOptions): Promise<GraphQLResult> {
    if (options.returnPartialData) {
      throw new Error('returnPartialData option only supported on watchQuery.');
    }

    return this.watchQuery(options).result();
  }

  public fetchQuery(queryId: string, options: WatchQueryOptions): Promise<GraphQLResult> {
    const {
      query,
      variables,
      forceFetch = false,
      returnPartialData = false,
    } = options;

    const queryDef = getQueryDefinition(query);
    const queryString = print(query);

    // Parse the query passed in -- this could also be done by a build plugin or tagged
    // template string
    const querySS = {
      id: 'ROOT_QUERY',
      typeName: 'Query',
      selectionSet: queryDef.selectionSet,
    } as SelectionSetWithRoot;

    // If we don't use diffing, then these will be the same as the original query
    let minimizedQueryString = queryString;
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

      if (missingSelectionSets && missingSelectionSets.length) {
        const diffedQueryDef = queryDefinition({
          missingSelectionSets,
          variableDefinitions: queryDef.variableDefinitions,
          name: queryDef.name,
        });

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

    const requestId = this.generateRequestId();

    // Initialize query in store with unique requestId
    this.store.dispatch({
      type: 'APOLLO_QUERY_INIT',
      queryString,
      query: querySS,
      minimizedQueryString,
      minimizedQuery,
      variables,
      forceFetch,
      returnPartialData,
      queryId,
      requestId,
    });

    if (! minimizedQuery || returnPartialData) {
      this.store.dispatch({
        type: 'APOLLO_QUERY_RESULT_CLIENT',
        result: {
          data: initialResult,
        },
        variables,
        query: querySS,
        complete: !! minimizedQuery,
        queryId,
      });
    }

    if (minimizedQuery) {
      const request: Request = {
        query: minimizedQueryString,
        variables,
      };

      return this.networkInterface.query(request)
        .then((result: GraphQLResult) => {
          // XXX handle multiple GraphQLResults
          this.store.dispatch({
            type: 'APOLLO_QUERY_RESULT',
            result,
            queryId,
            requestId,
          });

          return result;
        }).then(() => {

          let resultFromStore;
          try {
            // ensure result is combined with data already in store
            resultFromStore = readSelectionSetFromStore({
              store: this.getApolloState().data,
              rootId: querySS.id,
              selectionSet: querySS.selectionSet,
              variables,
              returnPartialData: returnPartialData,
            });
          // ensure multiple errors don't get thrown
          /* tslint:disable */
          } catch (e) {}
          /* tslint:enable */

          // return a chainable promise
          return new Promise((resolve) => {
            resolve({ data: resultFromStore });
          });
        }).catch((error: Error) => {
          this.store.dispatch({
            type: 'APOLLO_QUERY_ERROR',
            error,
            queryId,
            requestId,
          });

          return error;
        });
    }
    // return a chainable promise
    return new Promise((resolve) => {
      resolve({ data: initialResult });
    });
  }

  private getApolloState(): Store {
    return this.store.getState()[this.reduxRootKey];
  }

  private startQuery(options: WatchQueryOptions, listener: QueryListener) {
    const queryId = this.generateQueryId();
    this.queryListeners[queryId] = listener;
    this.fetchQuery(queryId, options);
    if (options.pollInterval) {
      this.pollingTimer = setInterval(() => {
        const pollingOptions = assign({}, options) as WatchQueryOptions;
        // subsequent fetches from polling always reqeust new data
        pollingOptions.forceFetch = true;
        this.fetchQuery(queryId, pollingOptions);
      }, options.pollInterval);
    }
    return queryId;
  }

  private stopQuery(queryId: string) {
    // XXX in the future if we should cancel the request
    // so that it never tries to return data
    delete this.queryListeners[queryId];

    // if we have a polling interval running, stop it
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
    }

    this.store.dispatch({
      type: 'APOLLO_QUERY_STOP',
      queryId,
    });
  }

  private broadcastQueries() {
    const queries = this.getApolloState().queries;
    forOwn(this.queryListeners, (listener: QueryListener, queryId: string) => {
      const queryStoreValue = queries[queryId];
      listener(queryStoreValue);
    });
  }

  private generateQueryId() {
    const queryId = this.idCounter.toString();
    this.idCounter++;
    return queryId;
  }

  private generateRequestId() {
    const requestId = this.idCounter;
    this.idCounter++;
    return requestId;
  }
}
