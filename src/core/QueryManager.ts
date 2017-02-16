import {
  NetworkInterface,
  SubscriptionNetworkInterface,
  Request,
} from '../transport/networkInterface';

import {
  Deduplicator,
} from '../transport/Deduplicator';

import { isEqual } from '../util/isEqual';

import {
  ResultTransformer,
  ResultComparator,
  QueryListener,
  ApolloQueryResult,
  PureQueryOptions,
  FetchType,
  SubscriptionOptions,
} from './types';

import {
  QueryStoreValue,
} from '../queries/store';

import {
  NetworkStatus,
  isNetworkRequestInFlight,
} from '../queries/networkStatus';

import {
  ApolloStore,
  Store,
  getDataWithOptimisticResults,
  ApolloReducerConfig,
  ApolloReducer,
} from '../store';

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
  isProduction,
} from '../util/environment';

import maybeDeepFreeze from '../util/maybeDeepFreeze';

import {
  ExecutionResult,
  DocumentNode,
  // TODO REFACTOR: do we still need this??
  // We need to import this here to allow TypeScript to include it in the definition file even
  // though we don't use it. https://github.com/Microsoft/TypeScript/issues/5711
  // We need to disable the linter here because TSLint rightfully complains that this is unused.
  /* tslint:disable */
  SelectionSetNode,
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
  MutationQueryReducersMap,
  MutationQueryReducer,
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

import { tryFunctionOrLogError } from '../util/errorHandling';

import {
  isApolloError,
  ApolloError,
} from '../errors/ApolloError';

import { WatchQueryOptions } from './watchQueryOptions';

import { ObservableQuery } from './ObservableQuery';

export class QueryManager {
  public pollingTimers: {[queryId: string]: any};
  public scheduler: QueryScheduler;
  public store: ApolloStore;

  private addTypename: boolean;
  private networkInterface: NetworkInterface;
  private deduplicator: Deduplicator;
  private reduxRootSelector: ApolloStateSelector;
  private resultTransformer: ResultTransformer | undefined;
  private resultComparator: ResultComparator | undefined;
  private reducerConfig: ApolloReducerConfig;
  private queryDeduplication: boolean;

  // TODO REFACTOR collect all operation-related info in one place (e.g. all these maps)
  // this should be combined with ObservableQuery, but that needs to be expanded to support
  // mutations and subscriptions as well.
  private queryListeners: { [queryId: string]: QueryListener[] };
  private queryDocuments: { [queryId: string]: DocumentNode };

  private idCounter = 1; // XXX let's not start at zero to avoid pain with bad checks

  // A map going from a requestId to a promise that has not yet been resolved. We use this to keep
  // track of queries that are inflight and reject them in case some
  // destabalizing action occurs (e.g. reset of the Apollo store).
  private fetchQueryPromises: { [requestId: string]: {
    promise: Promise<ApolloQueryResult<any>>;
    resolve: (result: ApolloQueryResult<any>) => void;
    reject: (error: Error) => void;
  } };

  // A map going from queryId to an observer for a query issued by watchQuery. We use
  // these to keep track of queries that are inflight and error on the observers associated
  // with them in case of some destabalizing action (e.g. reset of the Apollo store).
  private observableQueries: { [queryId: string]:  {
    observableQuery: ObservableQuery<any>;
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
    queryDeduplication = false,
  }: {
    networkInterface: NetworkInterface,
    store: ApolloStore,
    reduxRootSelector: ApolloStateSelector,
    reducerConfig?: ApolloReducerConfig,
    resultTransformer?: ResultTransformer,
    resultComparator?: ResultComparator,
    addTypename?: boolean,
    queryDeduplication?: boolean,
  }) {
    // XXX this might be the place to do introspection for inserting the `id` into the query? or
    // is that the network interface?
    this.networkInterface = networkInterface;
    this.deduplicator = new Deduplicator(networkInterface);
    this.store = store;
    this.reduxRootSelector = reduxRootSelector;
    this.reducerConfig = reducerConfig;
    this.resultTransformer = resultTransformer;
    this.resultComparator = resultComparator;
    this.pollingTimers = {};
    this.queryListeners = {};
    this.queryDocuments = {};
    this.addTypename = addTypename;
    this.queryDeduplication = queryDeduplication;

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

  public mutate<T>({
    mutation,
    variables,
    optimisticResponse,
    updateQueries: updateQueriesByName,
    refetchQueries = [],
  }: {
    mutation: DocumentNode,
    variables?: Object,
    optimisticResponse?: Object,
    updateQueries?: MutationQueryReducersMap,
    refetchQueries?: string[] | PureQueryOptions[],
  }): Promise<ApolloQueryResult<T>> {
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

    this.queryDocuments[mutationId] = mutation;

    // Create a map of update queries by id to the query instead of by name.
    const updateQueries: { [queryId: string]: MutationQueryReducer } = {};
    if (updateQueriesByName) {
      Object.keys(updateQueriesByName).forEach(queryName => (this.queryIdsByName[queryName] || []).forEach(queryId => {
        updateQueries[queryId] = updateQueriesByName[queryName];
      }));
    }

    this.store.dispatch({
      type: 'APOLLO_MUTATION_INIT',
      mutationString,
      mutation,
      variables: variables || {},
      operationName: getOperationName(mutation),
      mutationId,
      optimisticResponse,
      extraReducers: this.getExtraReducers(),
      updateQueries,
    });

    return new Promise((resolve, reject) => {
      this.networkInterface.query(request)
        .then((result) => {
          if (result.errors) {
            reject(new ApolloError({
              graphQLErrors: result.errors,
            }));
            return;
          }

          this.store.dispatch({
            type: 'APOLLO_MUTATION_RESULT',
            result,
            mutationId,
            document: mutation,
            operationName: getOperationName(mutation),
            variables: variables || {},
            extraReducers: this.getExtraReducers(),
            updateQueries,
          });

          // If there was an error in our reducers, reject this promise!
          const { reducerError } = this.getApolloState();
          if (reducerError) {
            reject(reducerError);
            return;
          }

          if (typeof refetchQueries[0] === 'string') {
            (refetchQueries as string[]).forEach((name) => { this.refetchQueryByName(name); });
          } else {
            (refetchQueries as PureQueryOptions[]).forEach( pureQuery => {
              this.query({
                query: pureQuery.query,
                variables: pureQuery.variables,
                forceFetch: true,
              });
            });
          }


          delete this.queryDocuments[mutationId];
          resolve(this.transformResult(<ApolloQueryResult<T>>result));
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
  public queryListenerForObserver<T>(
    queryId: string,
    options: WatchQueryOptions,
    observer: Observer<ApolloQueryResult<T>>,
  ): QueryListener {
    let lastResult: ApolloQueryResult<T>;
    return (queryStoreValue: QueryStoreValue) => {
      // The query store value can be undefined in the event of a store
      // reset.
      if (!queryStoreValue) {
        return;
      }

      const noFetch = this.observableQueries[queryId] ? this.observableQueries[queryId].observableQuery.options.noFetch : options.noFetch;

      const shouldNotifyIfLoading = queryStoreValue.returnPartialData
        || queryStoreValue.previousVariables || noFetch;

      const networkStatusChanged = lastResult && queryStoreValue.networkStatus !== lastResult.networkStatus;

      if (!isNetworkRequestInFlight(queryStoreValue.networkStatus) ||
          ( networkStatusChanged && options.notifyOnNetworkStatusChange ) ||
          shouldNotifyIfLoading) {
        // XXX Currently, returning errors and data is exclusive because we
        // don't handle partial results

        // If we have either a GraphQL error or a network error, we create
        // an error and tell the observer about it.
        if (
          (queryStoreValue.graphQLErrors && queryStoreValue.graphQLErrors.length > 0) ||
          queryStoreValue.networkError
        ) {
          const apolloError = new ApolloError({
            graphQLErrors: queryStoreValue.graphQLErrors,
            networkError: queryStoreValue.networkError,
          });
          if (observer.error) {
            try {
              observer.error(apolloError);
            } catch (e) {
              console.error(`Error in observer.error \n${e.stack}`);
            }
          } else {
            console.error('Unhandled error', apolloError, apolloError.stack);
            if (!isProduction()) {
              /* tslint:disable-next-line */
              console.info(
                'An unhandled error was thrown because no error handler is registered ' +
                'for the query ' + queryStoreValue.queryString,
              );
            }
          }
        } else {
          try {
            const resultFromStore: ApolloQueryResult<T> = {
              data: readQueryFromStore<T>({
                store: this.getDataWithOptimisticResults(),
                query: this.queryDocuments[queryId],
                variables: queryStoreValue.previousVariables || queryStoreValue.variables,
                returnPartialData: options.returnPartialData || noFetch,
                config: this.reducerConfig,
                previousResult: lastResult && lastResult.data,
              }),
              loading: isNetworkRequestInFlight(queryStoreValue.networkStatus),
              networkStatus: queryStoreValue.networkStatus,
            };

            if (observer.next) {
              const isDifferentResult =
                this.resultComparator ? !this.resultComparator(lastResult, resultFromStore) : !(
                  lastResult &&
                  resultFromStore &&
                  lastResult.networkStatus === resultFromStore.networkStatus &&

                  // We can do a strict equality check here because we include a `previousResult`
                  // with `readQueryFromStore`. So if the results are the same they will be
                  // referentially equal.
                  lastResult.data === resultFromStore.data
                );

              if (isDifferentResult) {
                lastResult = resultFromStore;
                try {
                  observer.next(maybeDeepFreeze(this.transformResult(resultFromStore)));
                } catch (e) {
                  console.error(`Error in observer.next \n${e.stack}`);
                }
              }
            }
          } catch (error) {
            if (observer.error) {
              observer.error(new ApolloError({
                networkError: error,
              }));
            }
            return;
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

  public watchQuery<T>(options: WatchQueryOptions, shouldSubscribe = true): ObservableQuery<T> {
    // Call just to get errors synchronously
    getQueryDefinition(options.query);

    let transformedOptions = { ...options } as WatchQueryOptions;
    if (this.addTypename) {
      transformedOptions.query = addTypenameToDocument(transformedOptions.query);
    }

    let observableQuery = new ObservableQuery<T>({
      scheduler: this.scheduler,
      options: transformedOptions,
      shouldSubscribe: shouldSubscribe,
    });

    return observableQuery;
  }

  public query<T>(options: WatchQueryOptions): Promise<ApolloQueryResult<T>> {
    if (options.returnPartialData) {
      throw new Error('returnPartialData option only supported on watchQuery.');
    }

    if (options.query.kind !== 'Document') {
      throw new Error('You must wrap the query string in a "gql" tag.');
    }

    const requestId = this.idCounter;
    const resPromise = new Promise((resolve, reject) => {
      this.addFetchQueryPromise<T>(requestId, resPromise, resolve, reject);

      return this.watchQuery<T>(options, false).result().then((result) => {
        this.removeFetchQueryPromise(requestId);
        resolve(result);
      }).catch((error) => {
        this.removeFetchQueryPromise(requestId);
        reject(error);
      });
    });

    return resPromise;
  }

  public fetchQuery<T>(queryId: string, options: WatchQueryOptions, fetchType?: FetchType): Promise<ApolloQueryResult<T>> {
    const {
      variables = {},
      forceFetch = false,
      returnPartialData = false,
      noFetch = false,
      metadata = null,
    } = options;

    const {
      queryDoc,
    } = this.transformQueryDocument(options);

    const queryString = print(queryDoc);

    let storeResult: any;
    let needToFetch: boolean = forceFetch;

    // If this is not a force fetch, we want to diff the query against the
    // store before we fetch it from the network interface.
    if (fetchType !== FetchType.refetch && !forceFetch) {
      const { isMissing, result } = diffQueryAgainstStore({
        query: queryDoc,
        store: this.reduxRootSelector(this.store.getState()).data,
        returnPartialData: true,
        variables,
        config: this.reducerConfig,
      });

      // If we're in here, only fetch if we have missing fields
      needToFetch = isMissing || false;

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
      metadata,
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
        requestId,
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

  public selectApolloState(store: any) {
    return this.reduxRootSelector(store.getState());
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
  public addFetchQueryPromise<T>(requestId: number, promise: Promise<ApolloQueryResult<T>>,
    resolve: (result: ApolloQueryResult<T>) => void,
    reject: (error: Error) => void) {
    this.fetchQueryPromises[requestId.toString()] = { promise, resolve, reject };
  }

  // Removes the promise in this.fetchQueryPromises for a particular request ID.
  public removeFetchQueryPromise(requestId: number) {
    delete this.fetchQueryPromises[requestId.toString()];
  }

  // Adds an ObservableQuery to this.observableQueries and to this.observableQueriesByName.
  public addObservableQuery<T>(queryId: string, observableQuery: ObservableQuery<T>) {
    this.observableQueries[queryId] = { observableQuery };

    // Insert the ObservableQuery into this.observableQueriesByName if the query has a name
    const queryDef = getQueryDefinition(observableQuery.options.query);
    if (queryDef.name && queryDef.name.value) {
      const queryName = queryDef.name.value;

      // XXX we may we want to warn the user about query name conflicts in the future
      this.queryIdsByName[queryName] = this.queryIdsByName[queryName] || [];
      this.queryIdsByName[queryName].push(observableQuery.queryId);
    }
  }

  public removeObservableQuery(queryId: string) {
    const observableQuery = this.observableQueries[queryId].observableQuery;
    const definition = getQueryDefinition(observableQuery.options.query);
    const queryName = definition.name ? definition.name.value : null;
    delete this.observableQueries[queryId];
    if (queryName) {
      this.queryIdsByName[queryName] = this.queryIdsByName[queryName].filter((val) => {
        return !(observableQuery.queryId === val);
      });
    }
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
      const storeQuery = this.reduxRootSelector(this.store.getState()).queries[queryId];

      if (!this.observableQueries[queryId].observableQuery.options.noFetch) {
        this.observableQueries[queryId].observableQuery.refetch();
      }
    });
  }

  public startQuery<T>(queryId: string, options: WatchQueryOptions, listener: QueryListener) {
    this.addQueryListener(queryId, listener);

    this.fetchQuery<T>(queryId, options)
    // `fetchQuery` returns a Promise. In case of a failure it should be caucht or else the
    // console will show an `Uncaught (in promise)` message. Ignore the error for now.
    .catch((error: Error) => undefined);

    return queryId;
  }

  public startGraphQLSubscription(
    options: SubscriptionOptions,
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
              if (obs.error) {
                obs.error(error);
              }
            });
          } else {
            this.store.dispatch({
              type: 'APOLLO_SUBSCRIPTION_RESULT',
              document: transformedDoc,
              operationName: getOperationName(transformedDoc),
              result: { data: result },
              variables: variables || {},
              subscriptionId: subId,
              extraReducers: this.getExtraReducers(),
            });
            // It's slightly awkward that the data for subscriptions doesn't come from the store.
            observers.forEach((obs) => {
              if (obs.next) {
                obs.next(result);
              }
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

  public getCurrentQueryResult<T>(observableQuery: ObservableQuery<T>, isOptimistic = false) {
    const {
      variables,
      document } = this.getQueryParts(observableQuery);

    const lastResult = observableQuery.getLastResult();

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
      previousResult: lastResult ? lastResult.data : undefined,
    };

    try {
      // first try reading the full result from the store
      const data = readQueryFromStore(readOptions);
      return maybeDeepFreeze({ data, partial: false });
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

      return maybeDeepFreeze({ data: {}, partial: true });
    }
  }

  public getQueryWithPreviousResult<T>(queryIdOrObservable: string | ObservableQuery<T>, isOptimistic = false) {
    let observableQuery: ObservableQuery<T>;
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
  public transformResult<T>(result: ApolloQueryResult<T>): ApolloQueryResult<T> {
    if (!this.resultTransformer) {
      return result;
    } else {
      return this.resultTransformer(result);
    }
  }

  // XXX: I think we just store this on the observable query at creation time
  // TODO LATER: rename this function. Its main role is to apply the transform, nothing else!
  private getQueryParts<T>(observableQuery: ObservableQuery<T>) {
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

  // Takes a set of WatchQueryOptions and transforms the query document
  // accordingly. Specifically, it applies the queryTransformer (if there is one defined)
  private transformQueryDocument(options: WatchQueryOptions): {
    queryDoc: DocumentNode,
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

  private getExtraReducers(): ApolloReducer[] {
    return  Object.keys(this.observableQueries).map( obsQueryId => {
      const query = this.observableQueries[obsQueryId].observableQuery;
      const queryOptions = query.options;

      if (queryOptions.reducer) {
        return createStoreReducer(
          queryOptions.reducer,
          queryOptions.query,
          query.variables || {},
          this.reducerConfig,
        );
      }
      return null as never;
    }).filter( reducer => reducer !== null );
  }

  // Takes a request id, query id, a query document and information associated with the query
  // and send it to the network interface. Returns
  // a promise for the result associated with that request.
  private fetchRequest<T>({
    requestId,
    queryId,
    document,
    options,
  }: {
    requestId: number,
    queryId: string,
    document: DocumentNode,
    options: WatchQueryOptions,
  }): Promise<ExecutionResult> {
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

    const retPromise = new Promise<ApolloQueryResult<T>>((resolve, reject) => {
      this.addFetchQueryPromise<T>(requestId, retPromise, resolve, reject);

      this.deduplicator.query(request, this.queryDeduplication)
        .then((result: ExecutionResult) => {

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
          if (isApolloError(error)) {
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

  private broadcastQueries() {
    const queries = this.getApolloState().queries;
    Object.keys(this.queryListeners).forEach((queryId: string) => {
      const listeners = this.queryListeners[queryId];
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
