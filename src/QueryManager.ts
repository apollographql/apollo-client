import {
  NetworkInterface,
  Request,
  BatchedNetworkInterface,
} from './networkInterface';


import forOwn = require('lodash.forown');
import assign = require('lodash.assign');
import isEqual = require('lodash.isequal');

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
  replaceOperationDefinition,
  getFragmentDefinitions,
  createFragmentMap,
} from './queries/getFromAST';

import {
  QueryTransformer,
  applyTransformerToOperation,
} from './queries/queryTransform';

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
  queryDocument,
} from './queryPrinting';

import {
  QueryFetchRequest,
} from './batching';

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
  private pollingTimers: {[queryId: string]: NodeJS.Timer | any}; //oddity in Typescript
  private queryTransformer: QueryTransformer;
  private queryListeners: { [queryId: string]: QueryListener };

  private idCounter = 0;

  constructor({
    networkInterface,
    store,
    reduxRootKey,
    queryTransformer,
  }: {
    networkInterface: NetworkInterface,
    store: ApolloStore,
    reduxRootKey: string,
    queryTransformer?: QueryTransformer,
  }) {
    // XXX this might be the place to do introspection for inserting the `id` into the query? or
    // is that the network interface?
    this.networkInterface = networkInterface;
    this.store = store;
    this.reduxRootKey = reduxRootKey;
    this.queryTransformer = queryTransformer;
    this.pollingTimers = {};

    this.queryListeners = {};

    // this.store is usually the fake store we get from the Redux middleware API
    // XXX for tests, we sometimes pass in a real Redux store into the QueryManager
    if (this.store['subscribe']) {
      let currentStoreData;
      this.store['subscribe'](() => {
        let previousStoreData = currentStoreData || {};
        const previousStoreHasData = Object.keys(previousStoreData).length;
        currentStoreData = this.getApolloState();
        if (isEqual(previousStoreData, currentStoreData) && previousStoreHasData) {
          return;
        }
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

    let mutationDef = getMutationDefinition(mutation);
    if (this.queryTransformer) {
      mutationDef = applyTransformerToOperation(mutationDef, this.queryTransformer);
      mutation = replaceOperationDefinition(mutation, mutationDef);
    }
    const mutationString = print(mutationDef);
    const request = {
      query: mutation,
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
              fragmentMap: queryStoreValue.fragmentMap,
            });

            if (observer.next) {
              observer.next({ data: resultFromStore });
            }
          }
        }
      });

      // get the polling timer reference associated with this
      // particular query.
      const pollingTimer = this.pollingTimers[queryId];

      return {
        unsubscribe: () => {
          this.stopQuery(queryId);
        },
        refetch: (variables: any): Promise<GraphQLResult> => {
          // if we are refetching, we clear out the polling interval
          // if the new refetch passes pollInterval: false, it won't recreate
          // the timer for subsequent refetches
          if (pollingTimer) {
            clearInterval(pollingTimer);
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
          if (pollingTimer) {
            clearInterval(pollingTimer);
          }
        },
        startPolling: (pollInterval): void => {
          this.pollingTimers[queryId] = setInterval(() => {
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

  // Sends several queries batched together into one fetch over the transport.
  public fetchManyQueries(fetchRequests: QueryFetchRequest[]): Promise<GraphQLResult[]> {
    // There are three types of promises used here.
    // - fillPromise: resolved once we have transformed each of the queries in
    // fetchRequests have been transformed by fetchQueryOverInterface().
    // - queryPromise: fetchQueryOverInterface() will write the results returned
    // by the server for a particular query after this promise is resolved.
    // - resultPromise: This is a promise returned by fetchQueryOverInterface().
    // It is resolved once the query results have been written to store (i.e.
    // the whole fetch procedure has been completed).
    const queryPromises: Promise<GraphQLResult>[] = [];
    const queryResolvers = [];
    const queryRejecters = [];

    const transformedRequests: Request[] = [];
    const resultPromises: Promise<GraphQLResult>[] = [];
    let fillResolve = null;
    let fillReject = null;

    const fillPromise = new Promise((resolve, reject) => {
      fillResolve = resolve;
      fillReject = reject;
    });


    const batchingNetworkInterface: NetworkInterface = {
      query(request: Request) {
        transformedRequests.push(request);
        const queryPromise = new Promise((resolve, reject) => {
          queryResolvers.push(resolve);
          queryRejecters.push(reject);
        });
        queryPromises.push(queryPromise);

        const retPromise = new Promise((resolve, reject) => {
          fillPromise.then(() => {
            queryPromise.then((result) => {
              resolve(result);
            });
          });
        });

        if (queryPromises.length === fetchRequests.length) {
          fillResolve();
        }

        return retPromise;
      },
    };

    fetchRequests.forEach((fetchRequest) => {
      const resultPromise = this.fetchQueryOverInterface(fetchRequest.queryId,
                                                         fetchRequest.options,
                                                         batchingNetworkInterface);
      resultPromises.push(resultPromise);
    });


    // wait until all of the queryPromise values have been added to queryPromises
    fillPromise.then(() => {
      const requestObjects: Request[] = transformedRequests;

      (this.networkInterface as BatchedNetworkInterface)
        .batchQuery(requestObjects).then((results) => {
        // Note: the server has to guarantee that the results will have the same
        // ordering as the queries that they correspond to.
        results.forEach((result, index) => {
          queryResolvers[index](result);
        });
      });
    });

    return Promise.all(resultPromises);
  }

  public fetchQuery(queryId: string, options: WatchQueryOptions): Promise<GraphQLResult> {
    return this.fetchQueryOverInterface(queryId, options, this.networkInterface);
  }

  private fetchQueryOverInterface(queryId: string,
                                  options: WatchQueryOptions,
                                  networkInterface: NetworkInterface): Promise<GraphQLResult> {
    const {
      query,
      variables,
      forceFetch = false,
      returnPartialData = false,
    } = options;

    let queryDef = getQueryDefinition(query);
    // Apply the query transformer if one has been provided.
    if (this.queryTransformer) {
      queryDef = applyTransformerToOperation(queryDef, this.queryTransformer);
    }
    const transformedQuery = replaceOperationDefinition(query, queryDef);
    const queryString = print(transformedQuery);
    const queryFragmentMap = createFragmentMap(getFragmentDefinitions(transformedQuery));

    // Parse the query passed in -- this could also be done by a build plugin or tagged
    // template string
    const querySS = {
      id: 'ROOT_QUERY',
      typeName: 'Query',
      selectionSet: queryDef.selectionSet,
    } as SelectionSetWithRoot;

    // If we don't use diffing, then these will be the same as the original query, other than
    // the queryTransformer that could have been applied.
    let minimizedQueryString = queryString;
    let minimizedQuery = querySS;
    let minimizedQueryDoc = transformedQuery;
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
        fragmentMap: queryFragmentMap,
      });

      initialResult = result;

      if (missingSelectionSets && missingSelectionSets.length) {
        const diffedQuery = queryDocument({
          missingSelectionSets,
          variableDefinitions: queryDef.variableDefinitions,
          name: queryDef.name,
          fragmentMap: queryFragmentMap,
        });
        const diffedQueryDef = getQueryDefinition(diffedQuery);

        minimizedQuery = {
          id: 'ROOT_QUERY',
          typeName: 'Query',
          selectionSet: diffedQueryDef.selectionSet,
        };

        minimizedQueryString = print(diffedQuery);
        minimizedQueryDoc = diffedQuery;
      } else {
        minimizedQuery = null;
        minimizedQueryString = null;
        minimizedQueryDoc = null;
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
      fragmentMap: queryFragmentMap,
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
        query: minimizedQueryDoc,
        variables,
      };

      return networkInterface.query(request)
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
              fragmentMap: queryFragmentMap,
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
      this.pollingTimers[queryId] = setInterval(() => {
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
    if (this.pollingTimers[queryId]) {
      clearInterval(this.pollingTimers[queryId]);
    }

    this.store.dispatch({
      type: 'APOLLO_QUERY_STOP',
      queryId,
    });
  }

  private broadcastQueries() {
    const queries = this.getApolloState().queries;
    forOwn(this.queryListeners, (listener: QueryListener, queryId: string) => {
      // it's possible for the listener to be undefined if the query is being stopped
      // See here for more detail: https://github.com/apollostack/apollo-client/issues/231
      if (listener) {
        const queryStoreValue = queries[queryId];
        listener(queryStoreValue);
      }
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
