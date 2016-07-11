import {
  NetworkInterface,
  Request,
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
  getOperationName,
  addFragmentsToDocument,
} from './queries/getFromAST';

import {
  QueryTransformer,
  applyTransformerToOperation,
} from './queries/queryTransform';

import {
  GraphQLResult,
  Document,
  FragmentDefinition,
} from 'graphql';

import { print } from 'graphql-tag/printer';

import {
  readSelectionSetFromStore,
} from './data/readFromStore';

import {
  diffSelectionSetAgainstStore,
} from './data/diffAgainstStore';

import {
  MutationBehavior,
} from './data/mutationResults';

import {
  queryDocument,
} from './queryPrinting';

import {
  QueryFetchRequest,
  QueryBatcher,
} from './batching';

import {
  QueryScheduler,
} from './scheduler';

import {
  ApolloQueryResult,
} from './index';

import { Observable, Observer, Subscription, SubscriberFunction } from './util/Observable';

import {
  ApolloError,
} from './errors';

export class ObservableQuery extends Observable<ApolloQueryResult> {
  public refetch: (variables?: any) => Promise<ApolloQueryResult>;
  public stopPolling: () => void;
  public startPolling: (p: number) => void;

  constructor(options: {
    subscriberFunction: SubscriberFunction<ApolloQueryResult>,
    refetch: (variables?: any) => Promise<ApolloQueryResult>,
    stopPolling: () => void,
    startPolling: (p: number) => void
  }) {
    super(options.subscriberFunction);
    this.refetch = options.refetch;
    this.stopPolling = options.stopPolling;
    this.startPolling = options.startPolling;
  }

  public subscribe(observer: Observer<ApolloQueryResult>): Subscription {
    return super.subscribe(observer);
  }

  public result(): Promise<ApolloQueryResult> {
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

export interface WatchQueryOptions {
  query: Document;
  variables?: { [key: string]: any };
  forceFetch?: boolean;
  returnPartialData?: boolean;
  pollInterval?: number;
  fragments?: FragmentDefinition[];
}

export type QueryListener = (queryStoreValue: QueryStoreValue) => void;

export class QueryManager {
  private networkInterface: NetworkInterface;
  private store: ApolloStore;
  private reduxRootKey: string;
  private pollingTimers: {[queryId: string]: NodeJS.Timer | any}; //oddity in Typescript
  private queryTransformer: QueryTransformer;
  private queryListeners: { [queryId: string]: QueryListener };

  private idCounter = 0;

  private scheduler: QueryScheduler;
  private batcher: QueryBatcher;
  private batcherPollInterval = 10;

  // A map going from an index (i.e. just like an array index, except that we can remove
  // some of them) to a promise that has not yet been resolved. We use this to keep
  // track of queries that are inflight and reject them in case some
  // destabalizing action occurs (e.g. reset of the Apollo store).
  private fetchQueryPromises: { [requestId: string]: {
    promise: Promise<ApolloQueryResult>;
    resolve: (result: ApolloQueryResult) => void;
    reject: (error: Error) => void;
  } };

  // A map going from queryId to an observer for a query issued by watchQuery. We use
  // these to keep track of queries that are inflight and error on the observers associated
  // with them in case of some destabalizing action (e.g. reset of the Apollo store).
  private observableQueries: { [queryId: string]:  {
    observableQuery: ObservableQuery;
    subscriptions: Subscription[];
  } };

  constructor({
    networkInterface,
    store,
    reduxRootKey,
    queryTransformer,
    shouldBatch = false,
  }: {
    networkInterface: NetworkInterface,
    store: ApolloStore,
    reduxRootKey: string,
    queryTransformer?: QueryTransformer,
    shouldBatch?: Boolean,
  }) {
    // XXX this might be the place to do introspection for inserting the `id` into the query? or
    // is that the network interface?
    this.networkInterface = networkInterface;
    this.store = store;
    this.reduxRootKey = reduxRootKey;
    this.queryTransformer = queryTransformer;
    this.pollingTimers = {};

    this.queryListeners = {};

    this.scheduler = new QueryScheduler({
      queryManager: this,
    });

    this.batcher = new QueryBatcher({
      shouldBatch,
      networkInterface: this.networkInterface,
    });

    this.batcher.start(this.batcherPollInterval);
    this.fetchQueryPromises = {};
    this.observableQueries = {};

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
    resultBehaviors,
    fragments = [],
  }: {
    mutation: Document,
    variables?: Object,
    resultBehaviors?: MutationBehavior[],
    fragments?: FragmentDefinition[],
  }): Promise<ApolloQueryResult> {
    const mutationId = this.generateQueryId();

    let mutationDef = getMutationDefinition(mutation);
    if (this.queryTransformer) {
      mutationDef = applyTransformerToOperation(mutationDef, this.queryTransformer);
      mutation = replaceOperationDefinition(mutation, mutationDef);
    }
    mutation = replaceOperationDefinition(mutation, mutationDef);

    // Add the fragments that were passed in to the mutation document and then
    // construct the fragment map.
    mutation = addFragmentsToDocument(mutation, fragments);

    const mutationString = print(mutation);
    const queryFragmentMap = createFragmentMap(getFragmentDefinitions(mutation));
    const request = {
      query: mutation,
      variables,
      operationName: getOperationName(mutation),
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
      fragmentMap: queryFragmentMap,
    });

    return this.networkInterface.query(request)
      .then((result) => {
        this.store.dispatch({
          type: 'APOLLO_MUTATION_RESULT',
          result,
          mutationId,
          resultBehaviors,
        });

        return result;

      });
  }

  // Returns a query listener that will update the given observer based on the
  // results (or lack thereof) for a particular query.
  public queryListenerForObserver(
    options: WatchQueryOptions,
    observer: Observer<ApolloQueryResult>
  ): QueryListener {
    return (queryStoreValue: QueryStoreValue) => {
      // The query store value can be undefined in the event of a store
      // reset.
      if (!queryStoreValue) {
        return;
      }

      if (!queryStoreValue.loading || queryStoreValue.returnPartialData) {
        // XXX Currently, returning errors and data is exclusive because we
        // don't handle partial results

        // If we have either a GraphQL error or a network error, we create
        // an error and tell the observer about it.
        if (queryStoreValue.graphQLErrors || queryStoreValue.networkError) {
          const apolloError = new ApolloError({
            graphQLErrors: queryStoreValue.graphQLErrors,
            networkError: queryStoreValue.networkError,
          });
          if (observer.error) {
            observer.error(apolloError);
          } else {
            console.error('Unhandled error', apolloError, apolloError.stack);
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
    };
  }

  // The shouldSubscribe option is a temporary fix that tells us whether watchQuery was called
  // directly (i.e. through ApolloClient) or through the query method within QueryManager.
  // Currently, the query method uses watchQuery in order to handle non-network errors correctly
  // but we don't want to keep track observables issued for the query method since those aren't
  // supposed to be refetched in the event of a store reset. Once we unify error handling for
  // network errors and non-network errors, the shouldSubscribe option will go away.

  // The fragments option within WatchQueryOptions specifies a list of fragments that can be
  // referenced by the query.
  // These fragments are used to compose queries out of a bunch of fragments for UI components.
  public watchQuery(options: WatchQueryOptions, shouldSubscribe = true): ObservableQuery {
    // Call just to get errors synchronously
    getQueryDefinition(options.query);

    const queryId = this.generateQueryId();

    let observableQuery;

    const subscriberFunction = (observer: Observer<ApolloQueryResult>) => {
      const retQuerySubscription = {
        unsubscribe: () => {
          this.stopQuery(queryId);
        },
      };

      if (shouldSubscribe) {
        this.addObservableQuery(queryId, observableQuery);
        this.addQuerySubscription(queryId, retQuerySubscription);
      }

      this.startQuery(
        queryId,
        options,
        this.queryListenerForObserver(options, observer)
      );

      return retQuerySubscription;
    };

    const refetch = (variables?: any) => {
      // If no new variables passed, use existing variables
      variables = variables || options.variables;

      // Use the same options as before, but with new variables and forceFetch true
      return this.fetchQuery(queryId, assign(options, {
        forceFetch: true,
        variables,
      }) as WatchQueryOptions);
    };

    const stopPolling = () => {
      if (this.pollingTimers[queryId]) {
        clearInterval(this.pollingTimers[queryId]);
      }
    };

    const startPolling = (pollInterval) => {
      this.pollingTimers[queryId] = setInterval(() => {
        const pollingOptions = assign({}, options) as WatchQueryOptions;
        // subsequent fetches from polling always reqeust new data
        pollingOptions.forceFetch = true;
        this.fetchQuery(queryId, pollingOptions);
      }, pollInterval);
    };

    observableQuery = new ObservableQuery({
      subscriberFunction,
      refetch,
      stopPolling,
      startPolling,
    });

    return observableQuery;
  }

  public query(options: WatchQueryOptions): Promise<ApolloQueryResult> {
    if (options.returnPartialData) {
      throw new Error('returnPartialData option only supported on watchQuery.');
    }

    if (options.query.kind !== 'Document') {
      throw new Error('You must wrap the query string in a "gql" tag.');
    }

    const requestId = this.idCounter;
    const resPromise = new Promise((resolve, reject) => {
      this.addFetchQueryPromise(requestId, resPromise, resolve, reject);

      return this.watchQuery(options, false).result().then((result) => {
        this.removeFetchQueryPromise(requestId);
        resolve(result);
      }).catch((error) => {
        this.removeFetchQueryPromise(requestId);
        reject(error);
      });
    });

    return resPromise;
  }

  public fetchQuery(queryId: string, options: WatchQueryOptions): Promise<ApolloQueryResult> {
    return this.fetchQueryOverInterface(queryId, options, this.networkInterface);
  }

  public generateQueryId() {
    const queryId = this.idCounter.toString();
    this.idCounter++;
    return queryId;
  }

  public stopQueryInStore(queryId: string) {
    this.store.dispatch({
      type: 'APOLLO_QUERY_STOP',
      queryId,
    });
  };

  public getApolloState(): Store {
    return this.store.getState()[this.reduxRootKey];
  }

  public addQueryListener(queryId: string, listener: QueryListener) {
    this.queryListeners[queryId] = listener;
  };

  public removeQueryListener(queryId: string) {
    delete this.queryListeners[queryId];
  }

  // Adds a promise to this.fetchQueryPromises for a given request ID.
  public addFetchQueryPromise(requestId: number, promise: Promise<ApolloQueryResult>,
    resolve: (result: ApolloQueryResult) => void,
    reject: (error: Error) => void) {
    this.fetchQueryPromises[requestId.toString()] = { promise, resolve, reject };
  }


  // Removes the promise in this.fetchQueryPromises for a particular request ID.
  public removeFetchQueryPromise(requestId: number) {
    delete this.fetchQueryPromises[requestId.toString()];
  }

  // Adds an ObservableQuery to this.observableQueries
  public addObservableQuery(queryId: string, observableQuery: ObservableQuery) {
    this.observableQueries[queryId] = { observableQuery, subscriptions: [] };
  }

  // Associates a query subscription with an ObservableQuery in this.observableQueries
  public addQuerySubscription(queryId: string, querySubscription: Subscription) {
    if (this.observableQueries.hasOwnProperty(queryId)) {
      this.observableQueries[queryId].subscriptions.push(querySubscription);
    } else {
      this.observableQueries[queryId] = {
        observableQuery: null,
        subscriptions: [querySubscription],
      };
    }
  }

  public removeObservableQuery(queryId: string) {
    delete this.observableQueries[queryId];
  }

  public resetStore(): void {
    // Before we have sent the reset action to the store,
    // we can no longer rely on the results returned by in-flight
    // requests since these may depend on values that previously existed
    // in the data portion of the store. So, we cancel the promises and observers
    // that we have issued so far and not yet resolved (in the case of
    // queries).
    Object.keys(this.fetchQueryPromises).forEach((key) => {
      const { reject } = this.fetchQueryPromises[key];
      reject(new Error('Store reset while query was in flight.'));
    });

    this.store.dispatch({
      type: 'APOLLO_STORE_RESET',
      observableQueryIds: Object.keys(this.observableQueries),
    });

    // Similarly, we have to have to refetch each of the queries currently being
    // observed. We refetch instead of error'ing on these since the assumption is that
    // resetting the store doesn't eliminate the need for the queries currently being
    // watched. If there is an existing query in flight when the store is reset,
    // the promise for it will be rejected and its results will not be written to the
    // store.
    Object.keys(this.observableQueries).forEach((queryId) => {
      this.observableQueries[queryId].observableQuery.refetch();
    });
  }

  private fetchQueryOverInterface(
    queryId: string,
    options: WatchQueryOptions,
    network: NetworkInterface
  ): Promise<ApolloQueryResult> {
    const {
      query,
      variables,
      forceFetch = false,
      returnPartialData = false,
      fragments = [],
    } = options;

    let queryDef = getQueryDefinition(query);
    // Apply the query transformer if one has been provided.
    if (this.queryTransformer) {
      queryDef = applyTransformerToOperation(queryDef, this.queryTransformer);
    }
    let transformedQuery = replaceOperationDefinition(query, queryDef);

    // Add the fragments passed in into the query and then create the fragment map
    transformedQuery = addFragmentsToDocument(transformedQuery, fragments);
    const queryFragmentMap = createFragmentMap(getFragmentDefinitions(transformedQuery));

    const queryString = print(transformedQuery);

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
        operationName: getOperationName(minimizedQueryDoc),
      };

      const fetchRequest: QueryFetchRequest = {
        options: { query: minimizedQueryDoc, variables },
        queryId: queryId,
        operationName: request.operationName,
      };

      const retPromise = new Promise<ApolloQueryResult>((resolve, reject) => {
        this.addFetchQueryPromise(requestId, retPromise, resolve, reject);

        return this.batcher.enqueueRequest(fetchRequest)
          .then((result: GraphQLResult) => {
            // XXX handle multiple ApolloQueryResults
            this.store.dispatch({
              type: 'APOLLO_QUERY_RESULT',
              result,
              queryId,
              requestId,
            });

            this.removeFetchQueryPromise(requestId);
            if (result.errors) {
              reject(new ApolloError({
                graphQLErrors: result.errors,
              }));
            }
            return result;
          }).then(() => {

            let resultFromStore;
            try {
              // ensure result is combined with data already in store
              // this will throw an error if there are missing fields in
              // the results if returnPartialData is false.
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
            this.removeFetchQueryPromise(requestId);
            resolve({ data: resultFromStore });
          }).catch((error: Error) => {
            this.store.dispatch({
              type: 'APOLLO_QUERY_ERROR',
              error,
              queryId,
              requestId,
            });

            this.removeFetchQueryPromise(requestId);
            reject(new ApolloError({
              networkError: error,
            }));
          });
      });
      return retPromise;
    }

    // return a chainable promise
    return new Promise((resolve) => {
      resolve({ data: initialResult });
    });
  }

  private startQuery(queryId: string, options: WatchQueryOptions, listener: QueryListener) {
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

  private generateRequestId() {
    const requestId = this.idCounter;
    this.idCounter++;
    return requestId;
  }
}
