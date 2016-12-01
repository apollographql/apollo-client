import {
  NetworkInterface,
  SubscriptionNetworkInterface,
  Request,
} from '../transport/networkInterface';

import forOwn = require('lodash.forown');
import isEqual = require('lodash.isequal');

import {
  ApolloStore,
  Store,
  getDataWithOptimisticResults,
  ApolloReducerConfig,
} from '../store';

import {
  QueryStoreValue,
} from '../queries/store';

import {
  checkDocument,
  getQueryDefinition,
  getOperationName,
} from '../queries/getFromAST';

import {
  addTypenameToDocument,
} from '../queries/queryTransform';

import {
  NormalizedCache,
} from '../data/storeUtils';

import {
  createStoreReducer,
} from '../data/resultReducers';

import {
  GraphQLResult,
  Document,
  // TODO REFACTOR: do we still need this??
  // We need to import this here to allow TypeScript to include it in the definition file even
  // though we don't use it. https://github.com/Microsoft/TypeScript/issues/5711
  // We need to disable the linter here because TSLint rightfully complains that this is unused.
  /* tslint:disable */
  SelectionSet,
  /* tslint:enable */
} from 'graphql';

import { print } from 'graphql-tag/printer';

import {
  readQueryFromStore,
  ReadQueryOptions,
} from '../data/readFromStore';

import {
  diffQueryAgainstStore,
} from '../data/readFromStore';

import {
  MutationBehavior,
  MutationQueryReducersMap,
} from '../data/mutationResults';

import {
  QueryScheduler,
} from '../scheduler/scheduler';

import {
  ApolloStateSelector,
} from '../ApolloClient';

import {
  Observer,
  Subscription,
  Observable,
} from '../util/Observable';

import {
  NetworkStatus,
} from '../queries/store';

import { tryFunctionOrLogError } from '../util/errorHandling';

import {
  ApolloError,
} from '../errors/ApolloError';

import { WatchQueryOptions } from './watchQueryOptions';

import { ObservableQuery } from './ObservableQuery';

export type QueryListener = (queryStoreValue: QueryStoreValue) => void;

export interface SubscriptionOptions {
  document: Document;
  variables?: { [key: string]: any };
};

export type ApolloQueryResult = {
  data: any;
  loading: boolean;
  networkStatus: NetworkStatus;

  // This type is different from the GraphQLResult type because it doesn't include errors.
  // Those are thrown via the standard promise/observer catch mechanism.
}

// A result transformer is given the data that is to be returned from the store from a query or
// mutation, and can modify or observe it before the value is provided to your application.
//
// For watched queries, the transformer is only called when the data retrieved from the server is
// different from previous.
//
// If the transformer wants to mutate results (say, by setting the prototype of result data), it
// will likely need to be paired with a custom resultComparator.  By default, Apollo performs a
// deep equality comparsion on results, and skips those that are considered equal - reducing
// re-renders.
export type ResultTransformer = (resultData: ApolloQueryResult) => ApolloQueryResult;

// Controls how Apollo compares two query results and considers their equality.  Two equal results
// will not trigger re-renders.
export type ResultComparator = (result1: ApolloQueryResult, result2: ApolloQueryResult) => boolean;

export enum FetchType {
  normal = 1,
  refetch = 2,
  poll = 3,
}

export class QueryManager {
  public pollingTimers: {[queryId: string]: NodeJS.Timer | any}; //oddity in Typescript
  public scheduler: QueryScheduler;
  public store: ApolloStore;

  private addTypename: boolean;
  private networkInterface: NetworkInterface;
  private reduxRootSelector: ApolloStateSelector;
  private resultTransformer: ResultTransformer;
  private resultComparator: ResultComparator;
  private reducerConfig: ApolloReducerConfig;

  // TODO REFACTOR collect all operation-related info in one place (e.g. all these maps)
  // this should be combined with ObservableQuery, but that needs to be expanded to support
  // mutations and subscriptions as well.
  private queryListeners: { [queryId: string]: QueryListener[] };
  private queryDocuments: { [queryId: string]: Document };

  private idCounter = 0;

  // A map going from a requestId to a promise that has not yet been resolved. We use this to keep
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
  } };

  // A map going from the name of a query to an observer issued for it by watchQuery. This is
  // generally used to refetches for refetchQueries and to update mutation results through
  // updateQueries.
  private queryIdsByName: { [queryName: string]: string[] };

  constructor({
    networkInterface,
    store,
    reduxRootSelector,
    reducerConfig = { mutationBehaviorReducers: {} },
    resultTransformer,
    resultComparator,
    addTypename = true,
  }: {
    networkInterface: NetworkInterface,
    store: ApolloStore,
    reduxRootSelector: ApolloStateSelector,
    reducerConfig?: ApolloReducerConfig,
    resultTransformer?: ResultTransformer,
    resultComparator?: ResultComparator,
    addTypename?: boolean,
  }) {
    // XXX this might be the place to do introspection for inserting the `id` into the query? or
    // is that the network interface?
    this.networkInterface = networkInterface;
    this.store = store;
    this.reduxRootSelector = reduxRootSelector;
    this.reducerConfig = reducerConfig;
    this.resultTransformer = resultTransformer;
    this.resultComparator = resultComparator;
    this.pollingTimers = {};
    this.queryListeners = {};
    this.queryDocuments = {};
    this.addTypename = addTypename;

    this.scheduler = new QueryScheduler({
      queryManager: this,
    });

    this.fetchQueryPromises = {};
    this.observableQueries = {};
    this.queryIdsByName = {};

    // this.store is usually the fake store we get from the Redux middleware API
    // XXX for tests, we sometimes pass in a real Redux store into the QueryManager
    if ((this.store as any)['subscribe']) {
      let currentStoreData: any;
      (this.store as any)['subscribe'](() => {
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
    resultBehaviors = [],
    optimisticResponse,
    updateQueries,
    refetchQueries = [],
  }: {
    mutation: Document,
    variables?: Object,
    resultBehaviors?: MutationBehavior[],
    optimisticResponse?: Object,
    updateQueries?: MutationQueryReducersMap,
    refetchQueries?: string[],
  }): Promise<ApolloQueryResult> {
    const mutationId = this.generateQueryId();

    if (this.addTypename) {
      mutation = addTypenameToDocument(mutation);
    }

    checkDocument(mutation);
    const mutationString = print(mutation);
    const request = {
      query: mutation,
      variables,
      operationName: getOperationName(mutation),
    } as Request;

    // Right now the way `updateQueries` feature is implemented relies on using
    // `resultBehaviors`, another feature that accomplishes the same goal but
    // provides more verbose syntax.
    // In the future we want to re-factor this part of code to avoid using
    // `resultBehaviors` so we can remove `resultBehaviors` entirely.
    const updateQueriesResultBehaviors = !optimisticResponse ? [] :
      this.collectResultBehaviorsFromUpdateQueries(updateQueries, { data: optimisticResponse }, true);

    this.queryDocuments[mutationId] = mutation;

    const extraReducers = Object.keys(this.observableQueries).map( queryId => {
      const queryOptions = this.observableQueries[queryId].observableQuery.options;
      if (queryOptions.reducer) {
        return createStoreReducer(
          queryOptions.reducer,
          queryOptions.query,
          queryOptions.variables,
          this.reducerConfig,
          );
      }
      return null;
    }).filter( reducer => reducer !== null );

    this.store.dispatch({
      type: 'APOLLO_MUTATION_INIT',
      mutationString,
      mutation,
      variables,
      operationName: getOperationName(mutation),
      mutationId,
      optimisticResponse,
      resultBehaviors: [...resultBehaviors, ...updateQueriesResultBehaviors],
      extraReducers,
    });

    return new Promise((resolve, reject) => {
      this.networkInterface.query(request)
        .then((result) => {
          if (result.errors) {
            reject(new ApolloError({
              graphQLErrors: result.errors,
            }));
          }

          this.store.dispatch({
            type: 'APOLLO_MUTATION_RESULT',
            result,
            mutationId,
            document: mutation,
            operationName: getOperationName(mutation),
            resultBehaviors: [
                ...resultBehaviors,
                ...this.collectResultBehaviorsFromUpdateQueries(updateQueries, result),
            ],
            extraReducers,
          });

          refetchQueries.forEach((name) => { this.refetchQueryByName(name); });
          delete this.queryDocuments[mutationId];
          resolve(this.transformResult(<ApolloQueryResult>result));
        })
        .catch((err) => {
          this.store.dispatch({
            type: 'APOLLO_MUTATION_ERROR',
            error: err,
            mutationId,
          });

          delete this.queryDocuments[mutationId];
          reject(new ApolloError({
            networkError: err,
          }));
        });
    });
  }

  // Returns a query listener that will update the given observer based on the
  // results (or lack thereof) for a particular query.
  public queryListenerForObserver(
    queryId: string,
    options: WatchQueryOptions,
    observer: Observer<ApolloQueryResult>
  ): QueryListener {
    let lastResult: ApolloQueryResult;
    return (queryStoreValue: QueryStoreValue) => {
      // The query store value can be undefined in the event of a store
      // reset.
      if (!queryStoreValue) {
        return;
      }

      const shouldNotifyIfLoading = queryStoreValue.returnPartialData
        || queryStoreValue.previousVariables;

      const networkStatusChanged = lastResult && queryStoreValue.networkStatus !== lastResult.networkStatus;

      if (!queryStoreValue.loading ||
          ( networkStatusChanged && options.notifyOnNetworkStatusChange ) ||
          shouldNotifyIfLoading) {
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
          let resultFromStore: any;
          try {
            resultFromStore = {
              data: readQueryFromStore({
                store: this.getDataWithOptimisticResults(),
                query: this.queryDocuments[queryId],
                variables: queryStoreValue.previousVariables || queryStoreValue.variables,
                returnPartialData: options.returnPartialData || options.noFetch,
                config: this.reducerConfig,
              }),
              loading: queryStoreValue.loading,
              networkStatus: queryStoreValue.networkStatus,
            };
          } catch (error) {
            if (observer.error) {
              observer.error(new ApolloError({
                networkError: error,
              }));
            }
            return;
          }
          if (observer.next) {
            if (this.isDifferentResult(lastResult, resultFromStore)) {
              lastResult = resultFromStore;
              observer.next(this.transformResult(resultFromStore));
            }
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

  public watchQuery(options: WatchQueryOptions, shouldSubscribe = true): ObservableQuery {
    // Call just to get errors synchronously
    getQueryDefinition(options.query);

    let transformedOptions = Object.assign({}, options) as WatchQueryOptions;
    if (this.addTypename) {
      transformedOptions.query = addTypenameToDocument(transformedOptions.query);
    }

    let observableQuery = new ObservableQuery({
      scheduler: this.scheduler,
      options: transformedOptions,
      shouldSubscribe: shouldSubscribe,
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

  public fetchQuery(queryId: string, options: WatchQueryOptions, fetchType?: FetchType): Promise<ApolloQueryResult> {
    const {
      variables,
      forceFetch = false,
      returnPartialData = false,
      noFetch = false,
    } = options;

    const {
      queryDoc,
    } = this.transformQueryDocument(options);

    const queryString = print(queryDoc);

    let storeResult: any;
    let needToFetch: boolean = forceFetch;

    // If this is not a force fetch, we want to diff the query against the
    // store before we fetch it from the network interface.
    if (!forceFetch) {
      const { isMissing, result } = diffQueryAgainstStore({
        query: queryDoc,
        store: this.reduxRootSelector(this.store.getState()).data,
        returnPartialData: true,
        variables,
        config: this.reducerConfig,
      });

      // If we're in here, only fetch if we have missing fields
      needToFetch = isMissing;

      storeResult = result;
    }

    const requestId = this.generateRequestId();
    const shouldFetch = needToFetch && !noFetch;

    // Initialize query in store with unique requestId
    this.queryDocuments[queryId] = queryDoc;
    this.store.dispatch({
      type: 'APOLLO_QUERY_INIT',
      queryString,
      document: queryDoc,
      variables,
      forceFetch,
      returnPartialData: returnPartialData || noFetch,
      queryId,
      requestId,
      // we store the old variables in order to trigger "loading new variables"
      // state if we know we will go to the server
      storePreviousVariables: shouldFetch,
      isPoll: fetchType === FetchType.poll,
      isRefetch: fetchType === FetchType.refetch,
    });

    // If there is no part of the query we need to fetch from the server (or,
    // noFetch is turned on), we just write the store result as the final result.
    if (!shouldFetch || returnPartialData) {
      this.store.dispatch({
        type: 'APOLLO_QUERY_RESULT_CLIENT',
        result: { data: storeResult },
        variables,
        document: queryDoc,
        complete: !shouldFetch,
        queryId,
      });
    }

    if (shouldFetch) {
      return this.fetchRequest({
        requestId,
        queryId,
        document: queryDoc,
        options,
      });
    }

    // If we have no query to send to the server, we should return the result
    // found within the store.
    return Promise.resolve({ data: storeResult });
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
    return this.reduxRootSelector(this.store.getState());
  }

  public getInitialState(): { data: Object } {
    return { data: this.getApolloState().data };
  }

  public getDataWithOptimisticResults(): NormalizedCache {
    return getDataWithOptimisticResults(this.getApolloState());
  }

  public addQueryListener(queryId: string, listener: QueryListener) {
    this.queryListeners[queryId] = this.queryListeners[queryId] || [];
    this.queryListeners[queryId].push(listener);
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

  // Adds an ObservableQuery to this.observableQueries and to this.observableQueriesByName.
  public addObservableQuery(queryId: string, observableQuery: ObservableQuery) {
    this.observableQueries[queryId] = { observableQuery };

    // Insert the ObservableQuery into this.observableQueriesByName if the query has a name
    const queryDef = getQueryDefinition(observableQuery.options.query);
    if (queryDef.name && queryDef.name.value) {
      const queryName = getQueryDefinition(observableQuery.options.query).name.value;

      // XXX we may we want to warn the user about query name conflicts in the future
      this.queryIdsByName[queryName] = this.queryIdsByName[queryName] || [];
      this.queryIdsByName[queryName].push(observableQuery.queryId);
    }
  }

  public removeObservableQuery(queryId: string) {
    const observableQuery = this.observableQueries[queryId].observableQuery;
    const queryName = getQueryDefinition(observableQuery.options.query).name.value;
    delete this.observableQueries[queryId];
    this.queryIdsByName[queryName] = this.queryIdsByName[queryName].filter((val) => {
      return !(observableQuery.queryId === val);
    });
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
      if (! this.observableQueries[queryId].observableQuery.options.noFetch) {
        this.observableQueries[queryId].observableQuery.refetch();
      }
    });
  }

  public startQuery(queryId: string, options: WatchQueryOptions, listener: QueryListener) {
    this.addQueryListener(queryId, listener);

    this.fetchQuery(queryId, options)
    // `fetchQuery` returns a Promise. In case of a failure it should be caucht or else the
    // console will show an `Uncaught (in promise)` message. Ignore the error for now.
    .catch((error: Error) => undefined);

    return queryId;
  }

  public startGraphQLSubscription(
    options: SubscriptionOptions
  ): Observable<any> {
    const {
      document,
      variables,
    } = options;
    let transformedDoc = document;
    // Apply the query transformer if one has been provided.
    if (this.addTypename) {
      transformedDoc = addTypenameToDocument(transformedDoc);
    }
    const request: Request = {
      query: transformedDoc,
      variables,
      operationName: getOperationName(transformedDoc),
    };

    let subId: number;
    let observers: Observer<any>[] = [];

    return new Observable((observer) => {
      observers.push(observer);

      // TODO REFACTOR: the result here is not a normal GraphQL result.

      // If this is the first observer, actually initiate the network subscription
      if (observers.length === 1) {
        const handler = (error: Error, result: any) => {
          if (error) {
            observers.forEach((obs) => {
              obs.error(error);
            });
          } else {
            this.store.dispatch({
              type: 'APOLLO_SUBSCRIPTION_RESULT',
              document: transformedDoc,
              operationName: getOperationName(transformedDoc),
              result: { data: result },
              variables,
              subscriptionId: subId,
              extraReducers: this.getExtraReducers(),
            });
            // It's slightly awkward that the data for subscriptions doesn't come from the store.
            observers.forEach((obs) => {
              obs.next(result);
            });
          }
        };

        // QueryManager sets up the handler so the query can be transformed. Alternatively,
        // pass in the transformer to the ObservableQuery.
        subId = (this.networkInterface as SubscriptionNetworkInterface).subscribe(
          request, handler);
      }

      return {
        unsubscribe: () => {
          observers = observers.filter((obs) => obs !== observer);

          // If we removed the last observer, tear down the network subscription
          if (observers.length === 0) {
            (this.networkInterface as SubscriptionNetworkInterface).unsubscribe(subId);
          }
        },
        // Used in tests...
        _networkSubscriptionId: subId,
      } as Subscription;
    });
  };

  public stopQuery(queryId: string) {
    // XXX in the future if we should cancel the request
    // so that it never tries to return data
    delete this.queryListeners[queryId];
    delete this.queryDocuments[queryId];
    this.stopQueryInStore(queryId);
  }

  public getCurrentQueryResult(observableQuery: ObservableQuery, isOptimistic = false) {
    const {
      variables,
      document } = this.getQueryParts(observableQuery);

    const queryOptions = observableQuery.options;
    const readOptions: ReadQueryOptions = {
      // In case of an optimistic change, apply reducer on top of the
      // results including previous optimistic updates. Otherwise, apply it
      // on top of the real data only.
      store: isOptimistic ? this.getDataWithOptimisticResults() : this.getApolloState().data,
      query: document,
      variables,
      returnPartialData: false,
      config: this.reducerConfig,
    };

    try {
      // first try reading the full result from the store
      const data = readQueryFromStore(readOptions);
      return { data, partial: false };
    } catch (e) {
      // next, try reading partial results, if we want them
      if (queryOptions.returnPartialData || queryOptions.noFetch) {
        try {
          readOptions.returnPartialData = true;
          const data = readQueryFromStore(readOptions);
          return { data, partial: true };
        } catch (e) {
          // fall through
        }
      }

      return { data: {}, partial: true };
    }
  }

  public getQueryWithPreviousResult(queryIdOrObservable: string | ObservableQuery, isOptimistic = false) {
    let observableQuery: ObservableQuery;
    if (typeof queryIdOrObservable === 'string') {
      if (!this.observableQueries[queryIdOrObservable]) {
        throw new Error(`ObservableQuery with this id doesn't exist: ${queryIdOrObservable}`);
      }

      observableQuery = this.observableQueries[queryIdOrObservable].observableQuery;
    } else {
      observableQuery = queryIdOrObservable;
    }

    const {
      variables,
      document } = this.getQueryParts(observableQuery);

    const { data } = this.getCurrentQueryResult(observableQuery, isOptimistic);

    return {
      previousResult: data,
      variables,
      document,
    };
  }

  // Give the result transformer a chance to observe or modify result data before it is passed on.
  public transformResult(result: ApolloQueryResult): ApolloQueryResult {
    if (!this.resultTransformer) {
      return result;
    } else {
      return this.resultTransformer(result);
    }
  }

  // XXX: I think we just store this on the observable query at creation time
  // TODO LATER: rename this function. Its main role is to apply the transform, nothing else!
  private getQueryParts(observableQuery: ObservableQuery) {
    const queryOptions = observableQuery.options;

    let transformedDoc = observableQuery.options.query;

    if (this.addTypename) {
      // TODO XXX: do we need to make a copy of the document before transforming it?
      transformedDoc = addTypenameToDocument(transformedDoc);
    }

    return {
      variables: queryOptions.variables,
      document: transformedDoc,
    };
  }

  private collectResultBehaviorsFromUpdateQueries(
    updateQueries: MutationQueryReducersMap,
    mutationResult: Object,
    isOptimistic = false
  ): MutationBehavior[] {
    if (!updateQueries) {
      return [];
    }
    const resultBehaviors: any[] = [];

    Object.keys(updateQueries).forEach((queryName) => {
      const reducer = updateQueries[queryName];
      const queryIds = this.queryIdsByName[queryName];
      if (!queryIds) {
        // XXX should throw an error?
        return;
      }

      queryIds.forEach((queryId) => {
        const {
          previousResult,
          variables,
          document,
        } = this.getQueryWithPreviousResult(queryId, isOptimistic);

        const newResult = tryFunctionOrLogError(() => reducer(
          previousResult, {
            mutationResult,
            queryName,
            queryVariables: variables,
          }));

        if (newResult) {
          resultBehaviors.push({
            type: 'QUERY_RESULT',
            newResult,
            variables,
            document,
          });
        }
      });
    });

    return resultBehaviors;
  }

  // Takes a set of WatchQueryOptions and transforms the query document
  // accordingly. Specifically, it applies the queryTransformer (if there is one defined)
  private transformQueryDocument(options: WatchQueryOptions): {
    queryDoc: Document,
  } {
    let queryDoc = options.query;

    // Apply the query transformer if one has been provided
    if (this.addTypename) {
      queryDoc = addTypenameToDocument(queryDoc);
    }

    return {
      queryDoc,
    };
  }

  private getExtraReducers() {
    return  Object.keys(this.observableQueries).map( obsQueryId => {
      const queryOptions = this.observableQueries[obsQueryId].observableQuery.options;
      if (queryOptions.reducer) {
        return createStoreReducer(
          queryOptions.reducer,
          queryOptions.query,
          queryOptions.variables,
          this.reducerConfig,
          );
      }
      return null;
    }).filter( reducer => reducer !== null );
  }

  // Takes a request id, query id, a query document and information associated with the query
  // and send it to the network interface. Returns
  // a promise for the result associated with that request.
  private fetchRequest({
    requestId,
    queryId,
    document,
    options,
  }: {
    requestId: number,
    queryId: string,
    document: Document,
    options: WatchQueryOptions,
  }): Promise<GraphQLResult> {
    const {
      variables,
      noFetch,
      returnPartialData,
    } = options;
    const request: Request = {
      query: document,
      variables,
      operationName: getOperationName(document),
    };

    const retPromise = new Promise<ApolloQueryResult>((resolve, reject) => {
      this.addFetchQueryPromise(requestId, retPromise, resolve, reject);

      this.networkInterface.query(request)
        .then((result: GraphQLResult) => {

          const extraReducers = this.getExtraReducers();

          // XXX handle multiple ApolloQueryResults
          this.store.dispatch({
            type: 'APOLLO_QUERY_RESULT',
            document,
            operationName: getOperationName(document),
            result,
            queryId,
            requestId,
            extraReducers,
          });

          this.removeFetchQueryPromise(requestId);

          // XXX this duplicates some logic in the store about identifying errors
          if (result.errors) {
            throw new ApolloError({
              graphQLErrors: result.errors,
            });
          }

          return result;
        }).then(() => {

          let resultFromStore: any;
          try {
            // ensure result is combined with data already in store
            // this will throw an error if there are missing fields in
            // the results if returnPartialData is false.
            resultFromStore = readQueryFromStore({
              store: this.getApolloState().data,
              variables,
              returnPartialData: returnPartialData || noFetch,
              query: document,
              config: this.reducerConfig,
            });
            // ensure multiple errors don't get thrown
            /* tslint:disable */
          } catch (e) {}
          /* tslint:enable */

          const {reducerError} = this.getApolloState();
          if (!resultFromStore && reducerError) {
            return Promise.reject(reducerError);
          }

          // return a chainable promise
          this.removeFetchQueryPromise(requestId);
          resolve({ data: resultFromStore, loading: false, networkStatus: NetworkStatus.ready });
          return null;
        }).catch((error: Error) => {
          // This is for the benefit of `refetch` promises, which currently don't get their errors
          // through the store like watchQuery observers do
          if (error instanceof ApolloError) {
            reject(error);
          } else {
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
          }
        });
    });

    return retPromise;
  }

  // Refetches a query given that query's name. Refetches
  // all ObservableQuery instances associated with the query name.
  private refetchQueryByName(queryName: string) {
    const refetchedQueries = this.queryIdsByName[queryName];
    // Warn if the query named does not exist (misnamed, or merely not yet fetched)
    if (refetchedQueries === undefined) {
      console.warn(`Warning: unknown query with name ${queryName} asked to refetch`);
    } else {
      refetchedQueries.forEach((queryId) => {
        this.observableQueries[queryId].observableQuery.refetch();
      });
    }
  }

  // check to see if two results are the same, given our resultComparator
  private isDifferentResult(lastResult: ApolloQueryResult, newResult: ApolloQueryResult): boolean {
    const comparator = this.resultComparator || isEqual;
    return !comparator(lastResult, newResult);
  }

  private broadcastQueries() {
    const queries = this.getApolloState().queries;
    forOwn(this.queryListeners, (listeners: QueryListener[], queryId: string) => {
      // XXX due to an unknown race condition listeners can sometimes be undefined here.
      // this prevents a crash but doesn't solve the root cause
      // see: https://github.com/apollostack/apollo-client/issues/833
      if (listeners) {
        listeners.forEach((listener: QueryListener) => {
          // it's possible for the listener to be undefined if the query is being stopped
          // See here for more detail: https://github.com/apollostack/apollo-client/issues/231
          if (listener) {
            const queryStoreValue = queries[queryId];
            listener(queryStoreValue);
          }
        });
      }
    });
  }

  private generateRequestId() {
    const requestId = this.idCounter;
    this.idCounter++;
    return requestId;
  }
}
