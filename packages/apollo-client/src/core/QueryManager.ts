import {
  execute,
  ApolloLink,
  makePromise,
  Operation as Request,
  FetchResult,
} from 'apollo-link-core';

import { Deduplicator } from '../transport/Deduplicator';

import { isEqual } from '../util/isEqual';
import { assign } from '../util/assign';

import {
  QueryListener,
  ApolloQueryResult,
  PureQueryOptions,
  FetchType,
} from './types';

import { QueryStore, QueryStoreValue } from '../queries/store';

import {
  NetworkStatus,
  isNetworkRequestInFlight,
} from '../queries/networkStatus';

import { ApolloReducerConfig } from '../store';

import {
  checkDocument,
  getQueryDefinition,
  getOperationDefinition,
  getOperationName,
  getDefaultValues,
  getMutationDefinition,
} from '../queries/getFromAST';

import { addTypenameToDocument } from '../queries/queryTransform';

import { DataProxy } from '../data/proxy';

import {
  FragmentMatcherInterface,
  HeuristicFragmentMatcher,
} from '../data/fragmentMatcher';

import { isProduction } from '../util/environment';

import maybeDeepFreeze from '../util/maybeDeepFreeze';

import { ExecutionResult, DocumentNode, SelectionSetNode } from 'graphql';

import { print } from 'graphql/language/printer';

import { readQueryFromStore, ReadQueryOptions } from '../data/readFromStore';

import { diffQueryAgainstStore } from '../data/readFromStore';

import { QueryWithUpdater } from '../data/store';

import {
  MutationQueryReducersMap,
  MutationQueryReducer,
} from '../data/mutationResults';

import { MutationStore } from '../mutations/store';

import { QueryScheduler } from '../scheduler/scheduler';

import { DataStore } from '../data/store';

import { Observer, Subscription, Observable } from '../util/Observable';

import { tryFunctionOrLogError } from '../util/errorHandling';

import { isApolloError, ApolloError } from '../errors/ApolloError';

import { WatchQueryOptions, SubscriptionOptions } from './watchQueryOptions';

import { ObservableQuery } from './ObservableQuery';

import { Cache } from '../data/cache';
import { InMemoryCache } from '../data/inMemoryCache';

export class QueryManager {
  public pollingTimers: { [queryId: string]: any };
  public scheduler: QueryScheduler;
  public link: ApolloLink;
  public ssrMode: boolean;
  public mutationStore: MutationStore = new MutationStore();
  public queryStore: QueryStore = new QueryStore();
  public dataStore: DataStore;

  private addTypename: boolean;
  private deduplicator: Deduplicator;
  private reducerConfig: ApolloReducerConfig;
  private queryDeduplication: boolean;
  private fragmentMatcher: FragmentMatcherInterface;

  private onBroadcast: () => void;

  // TODO REFACTOR collect all operation-related info in one place (e.g. all these maps)
  // this should be combined with ObservableQuery, but that needs to be expanded to support
  // mutations and subscriptions as well.
  private queryListeners: { [queryId: string]: QueryListener[] };
  private queryListenerWatchCancel: { [queryId: string]: (() => void) } = {};
  private queryListenerInvalidated: { [queryId: string]: boolean } = {};
  private queryDocuments: { [queryId: string]: DocumentNode };

  private idCounter = 1; // XXX let's not start at zero to avoid pain with bad checks

  // A map going from a requestId to a promise that has not yet been resolved. We use this to keep
  // track of queries that are inflight and reject them in case some
  // destabalizing action occurs (e.g. reset of the Apollo store).
  private fetchQueryPromises: {
    [requestId: string]: {
      promise: Promise<ApolloQueryResult<any>>;
      resolve: (result: ApolloQueryResult<any>) => void;
      reject: (error: Error) => void;
    };
  };

  // A map going from queryId to an observer for a query issued by watchQuery. We use
  // these to keep track of queries that are inflight and error on the observers associated
  // with them in case of some destabalizing action (e.g. reset of the Apollo store).
  private observableQueries: {
    [queryId: string]: {
      observableQuery: ObservableQuery<any>;
    };
  };

  // A map going from the name of a query to an observer issued for it by watchQuery. This is
  // generally used to refetches for refetchQueries and to update mutation results through
  // updateQueries.
  private queryIdsByName: { [queryName: string]: string[] };

  private lastRequestId: { [queryId: string]: number } = {};

  constructor({
    link,
    reducerConfig = {},
    fragmentMatcher,
    addTypename = true,
    queryDeduplication = false,
    ssrMode = false,
    initialCache,
    onBroadcast = () => undefined,
  }: {
    link: ApolloLink;
    fragmentMatcher?: FragmentMatcherInterface;
    reducerConfig?: ApolloReducerConfig;
    addTypename?: boolean;
    queryDeduplication?: boolean;
    ssrMode?: boolean;
    initialCache?: Cache;
    onBroadcast?: () => void;
  }) {
    // XXX this might be the place to do introspection for inserting the `id` into the query? or
    // is that the network interface?
    this.link = link;
    this.deduplicator = new Deduplicator(link);
    this.reducerConfig = reducerConfig;
    this.pollingTimers = {};
    this.queryListeners = {};
    this.queryDocuments = {};
    this.addTypename = addTypename;
    this.queryDeduplication = queryDeduplication;
    this.ssrMode = ssrMode;
    this.dataStore = new DataStore(
      reducerConfig,
      initialCache ? initialCache : new InMemoryCache(this.reducerConfig, {}),
    );
    this.onBroadcast = onBroadcast;

    // XXX This logic is duplicated in ApolloClient.ts for two reasons:
    // 1. we need it in ApolloClient.ts for readQuery and readFragment of the data proxy.
    // 2. we need it here so we don't have to rewrite all the tests.
    // in the longer term we should remove the need for 2 and move it to ApolloClient.ts only.
    if (typeof fragmentMatcher === 'undefined') {
      this.fragmentMatcher = new HeuristicFragmentMatcher();
    } else {
      this.fragmentMatcher = fragmentMatcher;
    }

    this.scheduler = new QueryScheduler({
      queryManager: this,
    });

    this.fetchQueryPromises = {};
    this.observableQueries = {};
    this.queryIdsByName = {};
  }

  public mutate<T>({
    mutation,
    variables,
    optimisticResponse,
    updateQueries: updateQueriesByName,
    refetchQueries = [],
    update: updateWithProxyFn,
  }: {
    mutation: DocumentNode;
    variables?: Object;
    optimisticResponse?: Object | Function;
    updateQueries?: MutationQueryReducersMap<T>;
    refetchQueries?: string[] | PureQueryOptions[];
    update?: (proxy: DataProxy, mutationResult: Object) => void;
  }): Promise<FetchResult<T>> {
    if (!mutation) {
      throw new Error(
        'mutation option is required. You must specify your GraphQL document in the mutation option.',
      );
    }

    const mutationId = this.generateQueryId();

    if (this.addTypename) {
      mutation = addTypenameToDocument(mutation);
    }

    variables = assign(
      {},
      getDefaultValues(getMutationDefinition(mutation)),
      variables,
    );

    const mutationString = print(mutation);
    const request = {
      query: mutation,
      variables,
      operationName: getOperationName(mutation),
    } as Request;

    this.queryDocuments[mutationId] = mutation;

    // Create a map of update queries by id to the query instead of by name.
    const generateUpdateQueriesInfo: () => {
      [queryId: string]: QueryWithUpdater;
    } = () => {
      const ret: { [queryId: string]: QueryWithUpdater } = {};

      if (updateQueriesByName) {
        Object.keys(updateQueriesByName).forEach(queryName =>
          (this.queryIdsByName[queryName] || []).forEach(queryId => {
            ret[queryId] = {
              updater: updateQueriesByName[queryName],
              query: this.queryStore.get(queryId),
            };
          }),
        );
      }

      return ret;
    };

    this.mutationStore.initMutation(mutationId, mutationString, variables);
    this.dataStore.markMutationInit({
      mutationId,
      document: mutation,
      variables: variables || {},
      updateQueries: generateUpdateQueriesInfo(),
      update: updateWithProxyFn,
      optimisticResponse,
    });

    this.broadcastQueries();

    const observable = execute(this.link, request);
    return new Promise((resolve, reject) => {
      makePromise(observable)
        .then((result: ExecutionResult) => {
          if (result.errors) {
            const error = new ApolloError({
              graphQLErrors: result.errors,
            });

            this.mutationStore.markMutationError(mutationId, error);
            this.dataStore.markMutationComplete(mutationId);
            this.broadcastQueries();

            delete this.queryDocuments[mutationId];
            reject(error);
            return;
          }

          this.mutationStore.markMutationResult(mutationId);
          this.dataStore.markMutationResult({
            mutationId,
            result,
            document: mutation,
            variables: variables || {},
            updateQueries: generateUpdateQueriesInfo(),
            update: updateWithProxyFn,
          });
          this.dataStore.markMutationComplete(mutationId);
          this.broadcastQueries();

          if (typeof refetchQueries[0] === 'string') {
            (refetchQueries as string[]).forEach(name => {
              this.refetchQueryByName(name);
            });
          } else {
            (refetchQueries as PureQueryOptions[]).forEach(pureQuery => {
              this.query({
                query: pureQuery.query,
                variables: pureQuery.variables,
                fetchPolicy: 'network-only',
              });
            });
          }

          delete this.queryDocuments[mutationId];
          resolve(result as FetchResult<T>);
        })
        .catch((err: Error) => {
          this.mutationStore.markMutationError(mutationId, err);
          this.dataStore.markMutationComplete(mutationId);
          this.broadcastQueries();

          delete this.queryDocuments[mutationId];
          reject(
            new ApolloError({
              networkError: err,
            }),
          );
        });
    });
  }

  public fetchQuery<T>(
    queryId: string,
    options: WatchQueryOptions,
    fetchType?: FetchType,
    // This allows us to track if this is a query spawned by a `fetchMore`
    // call for another query. We need this data to compute the `fetchMore`
    // network status for the query this is fetching for.
    fetchMoreForQueryId?: string,
  ): Promise<ExecutionResult> {
    const {
      variables = {},
      metadata = null,
      fetchPolicy = 'cache-first', // cache-first is the default fetch policy.
    } = options;

    const { queryDoc } = this.transformQueryDocument(options);

    const queryString = print(queryDoc);

    let storeResult: any;
    let needToFetch: boolean = fetchPolicy === 'network-only';

    // If this is not a force fetch, we want to diff the query against the
    // store before we fetch it from the network interface.
    // TODO we hit the cache even if the policy is network-first. This could be unnecessary if the network is up.
    if (fetchType !== FetchType.refetch && fetchPolicy !== 'network-only') {
      const { isMissing, result } = this.dataStore.getCache().diffQuery({
        query: queryDoc,
        variables,
        returnPartialData: true,
        optimistic: false,
      });

      // If we're in here, only fetch if we have missing fields
      needToFetch = isMissing || fetchPolicy === 'cache-and-network';

      storeResult = result;
    }

    const shouldFetch =
      needToFetch && fetchPolicy !== 'cache-only' && fetchPolicy !== 'standby';

    const requestId = this.generateRequestId();

    // Initialize query in store with unique requestId
    this.queryDocuments[queryId] = queryDoc;

    this.queryStore.initQuery({
      queryId,
      queryString,
      document: queryDoc,
      storePreviousVariables: shouldFetch,
      variables,
      isPoll: fetchType === FetchType.poll,
      isRefetch: fetchType === FetchType.refetch,
      metadata,
      fetchMoreForQueryId,
    });

    this.queryListenerInvalidated[queryId] = true;

    if (fetchMoreForQueryId) {
      this.queryListenerInvalidated[fetchMoreForQueryId] = true;
    }

    this.broadcastQueries();

    this.lastRequestId[queryId] = requestId;

    // If there is no part of the query we need to fetch from the server (or,
    // fetchPolicy is cache-only), we just write the store result as the final result.
    const shouldDispatchClientResult =
      !shouldFetch || fetchPolicy === 'cache-and-network';
    if (shouldDispatchClientResult) {
      this.queryStore.markQueryResultClient(queryId, !shouldFetch);
      this.queryListenerInvalidated[queryId] = true;
      if (fetchMoreForQueryId) {
        this.queryListenerInvalidated[fetchMoreForQueryId] = true;
      }
      this.broadcastQueries();
    }

    if (shouldFetch) {
      const networkResult = this.fetchRequest({
        requestId,
        queryId,
        document: queryDoc,
        options,
        fetchMoreForQueryId,
      }).catch(error => {
        // This is for the benefit of `refetch` promises, which currently don't get their errors
        // through the store like watchQuery observers do
        if (isApolloError(error)) {
          throw error;
        } else {
          if (requestId >= (this.lastRequestId[queryId] || 1)) {
            this.queryStore.markQueryError(queryId, error, fetchMoreForQueryId);
            this.queryListenerInvalidated[queryId] = true;
            if (fetchMoreForQueryId) {
              this.queryListenerInvalidated[fetchMoreForQueryId] = true;
            }

            this.broadcastQueries();
          }

          this.removeFetchQueryPromise(requestId);

          throw new ApolloError({
            networkError: error,
          });
        }
      });

      if (fetchPolicy !== 'cache-and-network') {
        return networkResult;
      }
    }
    // If we have no query to send to the server, we should return the result
    // found within the store.
    return Promise.resolve<ExecutionResult>({ data: storeResult });
  }

  // Returns a query listener that will update the given observer based on the
  // results (or lack thereof) for a particular query.
  public queryListenerForObserver<T>(
    queryId: string,
    options: WatchQueryOptions,
    observer: Observer<ApolloQueryResult<T>>,
  ): QueryListener {
    let previouslyHadError: boolean = false;
    return (queryStoreValue: QueryStoreValue) => {
      // The query store value can be undefined in the event of a store
      // reset.
      if (!queryStoreValue) {
        return;
      }

      // XXX This is to fix a strange race condition that was the root cause of react-apollo/#170
      // queryStoreValue was sometimes the old queryStoreValue and not what's currently in the store.
      queryStoreValue = this.queryStore.get(queryId);

      const storedQuery = this.observableQueries[queryId];
      const observableQuery = storedQuery ? storedQuery.observableQuery : null;

      const fetchPolicy = observableQuery
        ? observableQuery.options.fetchPolicy
        : options.fetchPolicy;

      if (fetchPolicy === 'standby') {
        // don't watch the store for queries on standby
        return;
      }

      const lastResult = observableQuery
        ? observableQuery.getLastResult()
        : null;

      const shouldNotifyIfLoading =
        queryStoreValue.previousVariables ||
        fetchPolicy === 'cache-only' ||
        fetchPolicy === 'cache-and-network';

      const networkStatusChanged =
        lastResult &&
        queryStoreValue.networkStatus !== lastResult.networkStatus;

      if (
        !isNetworkRequestInFlight(queryStoreValue.networkStatus) ||
        (networkStatusChanged && options.notifyOnNetworkStatusChange) ||
        shouldNotifyIfLoading
      ) {
        // XXX Currently, returning errors and data is exclusive because we
        // don't handle partial results

        // If we have either a GraphQL error or a network error, we create
        // an error and tell the observer about it.
        if (
          (queryStoreValue.graphQLErrors &&
            queryStoreValue.graphQLErrors.length > 0) ||
          queryStoreValue.networkError
        ) {
          const apolloError = new ApolloError({
            graphQLErrors: queryStoreValue.graphQLErrors,
            networkError: queryStoreValue.networkError,
          });
          previouslyHadError = true;
          if (observer.error) {
            try {
              observer.error(apolloError);
            } catch (e) {
              // Throw error outside this control flow to avoid breaking Apollo's state
              setTimeout(() => {
                throw e;
              }, 0);
            }
          } else {
            // Throw error outside this control flow to avoid breaking Apollo's state
            setTimeout(() => {
              throw apolloError;
            }, 0);
            if (!isProduction()) {
              /* tslint:disable-next-line */
              console.info(
                'An unhandled error was thrown because no error handler is registered ' +
                  'for the query ' +
                  queryStoreValue.queryString,
              );
            }
          }
        } else {
          try {
            const {
              result: data,
              isMissing,
            } = this.dataStore.getCache().diffQuery({
              query: this.queryDocuments[queryId],
              variables:
                queryStoreValue.previousVariables || queryStoreValue.variables,
              previousResult: lastResult && lastResult.data,
              optimistic: true,
            });

            let resultFromStore: ApolloQueryResult<T>;

            // If there is some data missing and the user has told us that they
            // do not tolerate partial data then we want to return the previous
            // result and mark it as stale.
            if (isMissing && fetchPolicy !== 'cache-only') {
              resultFromStore = {
                data: lastResult && lastResult.data,
                loading: isNetworkRequestInFlight(
                  queryStoreValue.networkStatus,
                ),
                networkStatus: queryStoreValue.networkStatus,
                stale: true,
              };
            } else {
              resultFromStore = {
                data,
                loading: isNetworkRequestInFlight(
                  queryStoreValue.networkStatus,
                ),
                networkStatus: queryStoreValue.networkStatus,
                stale: false,
              };
            }

            if (observer.next) {
              const isDifferentResult = !(
                lastResult &&
                resultFromStore &&
                lastResult.networkStatus === resultFromStore.networkStatus &&
                lastResult.stale === resultFromStore.stale &&
                // We can do a strict equality check here because we include a `previousResult`
                // with `readQueryFromStore`. So if the results are the same they will be
                // referentially equal.
                lastResult.data === resultFromStore.data
              );

              if (isDifferentResult || previouslyHadError) {
                try {
                  observer.next(maybeDeepFreeze(resultFromStore));
                } catch (e) {
                  // Throw error outside this control flow to avoid breaking Apollo's state
                  setTimeout(() => {
                    throw e;
                  }, 0);
                }
              }
            }
            previouslyHadError = false;
          } catch (error) {
            previouslyHadError = true;
            if (observer.error) {
              observer.error(
                new ApolloError({
                  networkError: error,
                }),
              );
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

  public watchQuery<T>(
    options: WatchQueryOptions,
    shouldSubscribe = true,
  ): ObservableQuery<T> {
    if (options.fetchPolicy === 'standby') {
      throw new Error(
        'client.watchQuery cannot be called with fetchPolicy set to "standby"',
      );
    }

    // get errors synchronously
    const queryDefinition = getQueryDefinition(options.query);

    // assign variable default values if supplied
    if (
      queryDefinition.variableDefinitions &&
      queryDefinition.variableDefinitions.length
    ) {
      const defaultValues = getDefaultValues(queryDefinition);

      options.variables = assign({}, defaultValues, options.variables);
    }

    if (typeof options.notifyOnNetworkStatusChange === 'undefined') {
      options.notifyOnNetworkStatusChange = false;
    }

    let transformedOptions = { ...options } as WatchQueryOptions;
    // if (this.addTypename) {
    //  transformedOptions.query = addTypenameToDocument(transformedOptions.query);
    // }

    let observableQuery = new ObservableQuery<T>({
      scheduler: this.scheduler,
      options: transformedOptions,
      shouldSubscribe: shouldSubscribe,
    });

    return observableQuery;
  }

  public query<T>(options: WatchQueryOptions): Promise<ApolloQueryResult<T>> {
    if (!options.query) {
      throw new Error(
        'query option is required. You must specify your GraphQL document in the query option.',
      );
    }

    if (options.query.kind !== 'Document') {
      throw new Error('You must wrap the query string in a "gql" tag.');
    }

    if ((options as any).returnPartialData) {
      throw new Error('returnPartialData option only supported on watchQuery.');
    }

    if ((options as any).pollInterval) {
      throw new Error('pollInterval option only supported on watchQuery.');
    }

    if (typeof options.notifyOnNetworkStatusChange !== 'undefined') {
      throw new Error(
        'Cannot call "query" with "notifyOnNetworkStatusChange" option. Only "watchQuery" has that option.',
      );
    }
    options.notifyOnNetworkStatusChange = false;

    const requestId = this.idCounter;
    const resPromise = new Promise<ApolloQueryResult<T>>((resolve, reject) => {
      this.addFetchQueryPromise<T>(requestId, resPromise, resolve, reject);

      return this.watchQuery<T>(options, false)
        .result()
        .then(result => {
          this.removeFetchQueryPromise(requestId);
          resolve(result);
        })
        .catch(error => {
          this.removeFetchQueryPromise(requestId);
          reject(error);
        });
    });

    return resPromise;
  }

  public generateQueryId() {
    const queryId = this.idCounter.toString();
    this.idCounter++;
    return queryId;
  }

  public stopQueryInStore(queryId: string) {
    this.queryStore.stopQuery(queryId);
    this.queryListenerInvalidated[queryId] = true;
    this.broadcastQueries();
  }

  public addQueryListener(
    queryId: string,
    listener: QueryListener,
    options: WatchQueryOptions,
  ) {
    this.queryListeners[queryId] = this.queryListeners[queryId] || [];

    if (this.queryListenerWatchCancel[queryId]) {
      this.queryListenerWatchCancel[queryId]();
    }

    this.queryListenerInvalidated[queryId] = false;
    this.queryListeners[queryId].push(listener);

    this.queryListenerWatchCancel[queryId] = this.dataStore.getCache().watch(
      {
        query: options.query,
        variables: options.variables,
        optimistic: true,
      },
      () => (this.queryListenerInvalidated[queryId] = true),
    );
  }

  // Adds a promise to this.fetchQueryPromises for a given request ID.
  public addFetchQueryPromise<T>(
    requestId: number,
    promise: Promise<ApolloQueryResult<T>>,
    resolve: (result: ApolloQueryResult<T>) => void,
    reject: (error: Error) => void,
  ) {
    this.fetchQueryPromises[requestId.toString()] = {
      promise,
      resolve,
      reject,
    };
  }

  // Removes the promise in this.fetchQueryPromises for a particular request ID.
  public removeFetchQueryPromise(requestId: number) {
    delete this.fetchQueryPromises[requestId.toString()];
  }

  // Adds an ObservableQuery to this.observableQueries and to this.observableQueriesByName.
  public addObservableQuery<T>(
    queryId: string,
    observableQuery: ObservableQuery<T>,
  ) {
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
      this.queryIdsByName[queryName] = this.queryIdsByName[
        queryName
      ].filter(val => {
        return !(observableQuery.queryId === val);
      });
    }
  }

  public resetStore(): Promise<ApolloQueryResult<any>[]> {
    // Before we have sent the reset action to the store,
    // we can no longer rely on the results returned by in-flight
    // requests since these may depend on values that previously existed
    // in the data portion of the store. So, we cancel the promises and observers
    // that we have issued so far and not yet resolved (in the case of
    // queries).
    Object.keys(this.fetchQueryPromises).forEach(key => {
      const { reject } = this.fetchQueryPromises[key];
      reject(new Error('Store reset while query was in flight.'));
    });

    this.queryStore.reset(Object.keys(this.observableQueries));
    this.mutationStore.reset();
    const dataStoreReset = this.dataStore.reset();

    // Similarly, we have to have to refetch each of the queries currently being
    // observed. We refetch instead of error'ing on these since the assumption is that
    // resetting the store doesn't eliminate the need for the queries currently being
    // watched. If there is an existing query in flight when the store is reset,
    // the promise for it will be rejected and its results will not be written to the
    // store.
    const observableQueryPromises: Promise<ApolloQueryResult<any>>[] = [];
    Object.keys(this.observableQueries).forEach(queryId => {
      const storeQuery = this.queryStore.get(queryId);

      const fetchPolicy = this.observableQueries[queryId].observableQuery
        .options.fetchPolicy;

      if (fetchPolicy !== 'cache-only' && fetchPolicy !== 'standby') {
        observableQueryPromises.push(
          this.observableQueries[queryId].observableQuery.refetch(),
        );
      }

      this.queryListenerInvalidated[queryId] = true;
    });

    this.broadcastQueries();

    return dataStoreReset.then(() => Promise.all(observableQueryPromises));
  }

  public startQuery<T>(
    queryId: string,
    options: WatchQueryOptions,
    listener: QueryListener,
  ) {
    this.addQueryListener(queryId, listener, options);

    this.fetchQuery<T>(queryId, options)
      // `fetchQuery` returns a Promise. In case of a failure it should be caucht or else the
      // console will show an `Uncaught (in promise)` message. Ignore the error for now.
      .catch((error: Error) => undefined);

    return queryId;
  }

  public startGraphQLSubscription(
    options: SubscriptionOptions,
  ): Observable<any> {
    const { query } = options;
    let transformedDoc = query;
    // Apply the query transformer if one has been provided.
    if (this.addTypename) {
      transformedDoc = addTypenameToDocument(transformedDoc);
    }

    const variables = assign(
      {},
      getDefaultValues(getOperationDefinition(query)),
      options.variables,
    );

    const request: Request = {
      query: transformedDoc,
      variables,
      operationName: getOperationName(transformedDoc),
    };

    let sub: Subscription;
    let observers: Observer<any>[] = [];

    return new Observable(observer => {
      observers.push(observer);

      // If this is the first observer, actually initiate the network subscription
      if (observers.length === 1) {
        const handler = {
          next: (result: FetchResult) => {
            this.dataStore.markSubscriptionResult(
              result,
              transformedDoc,
              variables,
            );
            this.broadcastQueries();

            // It's slightly awkward that the data for subscriptions doesn't come from the store.
            observers.forEach(obs => {
              if (obs.next) obs.next(result);
            });
          },
          error: (error: Error) => {
            observers.forEach(obs => {
              if (obs.error) obs.error(error);
            });
          },
        };

        sub = execute(this.link, request).subscribe(handler);
      }

      return {
        unsubscribe: () => {
          observers = observers.filter(obs => obs !== observer);

          // If we removed the last observer, tear down the network subscription
          if (observers.length === 0 && sub) {
            sub.unsubscribe();
          }
        },
      };
    });
  }

  public removeQuery(queryId: string) {
    delete this.queryListeners[queryId];
    delete this.queryDocuments[queryId];
  }

  public stopQuery(queryId: string) {
    // XXX in the future if we should cancel the request
    // so that it never tries to return data
    this.removeQuery(queryId);
    this.stopQueryInStore(queryId);
  }

  public getCurrentQueryResult<T>(
    observableQuery: ObservableQuery<T>,
    isOptimistic = false,
  ) {
    const { variables, document } = this.getQueryParts(observableQuery);

    const lastResult = observableQuery.getLastResult();

    try {
      // first try reading the full result from the store
      // const data = ;
      const data = this.dataStore.getCache().read({
        query: document,
        variables,
        previousResult: lastResult ? lastResult.data : undefined,
        optimistic: isOptimistic,
      });

      return maybeDeepFreeze({ data, partial: false });
    } catch (e) {
      return maybeDeepFreeze({ data: {}, partial: true });
    }
  }

  public getQueryWithPreviousResult<T>(
    queryIdOrObservable: string | ObservableQuery<T>,
    isOptimistic = false,
  ) {
    let observableQuery: ObservableQuery<T>;
    if (typeof queryIdOrObservable === 'string') {
      if (!this.observableQueries[queryIdOrObservable]) {
        throw new Error(
          `ObservableQuery with this id doesn't exist: ${queryIdOrObservable}`,
        );
      }

      observableQuery = this.observableQueries[queryIdOrObservable]
        .observableQuery;
    } else {
      observableQuery = queryIdOrObservable;
    }

    const { variables, document } = this.getQueryParts(observableQuery);

    const { data } = this.getCurrentQueryResult(observableQuery, isOptimistic);

    return {
      previousResult: data,
      variables,
      document,
    };
  }

  public broadcastQueries() {
    this.onBroadcast();
    Object.keys(this.queryListeners).forEach((queryId: string) => {
      const listeners = this.queryListeners[queryId];
      // XXX due to an unknown race condition listeners can sometimes be undefined here.
      // this prevents a crash but doesn't solve the root cause
      // see: https://github.com/apollostack/apollo-client/issues/833
      if (listeners && this.queryListenerInvalidated[queryId]) {
        this.queryListenerInvalidated[queryId] = false;
        listeners.forEach((listener: QueryListener) => {
          // it's possible for the listener to be undefined if the query is being stopped
          // See here for more detail: https://github.com/apollostack/apollo-client/issues/231
          if (listener) {
            const queryStoreValue = this.queryStore.get(queryId);
            listener(queryStoreValue);
          }
        });
      }
    });
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
  private transformQueryDocument(
    options: WatchQueryOptions,
  ): {
    queryDoc: DocumentNode;
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

  // Takes a request id, query id, a query document and information associated with the query
  // and send it to the network interface. Returns
  // a promise for the result associated with that request.
  private fetchRequest<T>({
    requestId,
    queryId,
    document,
    options,
    fetchMoreForQueryId,
  }: {
    requestId: number;
    queryId: string;
    document: DocumentNode;
    options: WatchQueryOptions;
    fetchMoreForQueryId?: string;
  }): Promise<ExecutionResult> {
    const { variables } = options;
    const request: Request = {
      query: document,
      variables,
      operationName: getOperationName(document),
    };

    const retPromise = new Promise<ApolloQueryResult<T>>((resolve, reject) => {
      this.addFetchQueryPromise<T>(requestId, retPromise, resolve, reject);

      this.deduplicator
        .query(request, this.queryDeduplication)
        .then((result: ExecutionResult) => {
          // default the lastRequestId to 1
          if (requestId >= (this.lastRequestId[queryId] || 1)) {
            // XXX handle multiple ApolloQueryResults

            this.dataStore.markQueryResult(
              queryId,
              requestId,
              result,
              document,
              variables,
              fetchMoreForQueryId,
            );

            this.queryStore.markQueryResult(
              queryId,
              result,
              fetchMoreForQueryId,
            );

            this.queryListenerInvalidated[queryId] = true;

            if (fetchMoreForQueryId) {
              this.queryListenerInvalidated[fetchMoreForQueryId] = true;
            }

            this.broadcastQueries();
          }

          this.removeFetchQueryPromise(requestId);

          // XXX this duplicates some logic in the store about identifying errors
          if (result.errors) {
            throw new ApolloError({
              graphQLErrors: result.errors,
            });
          }

          return result;
        })
        .then(result => {
          let resultFromStore: any;

          if (fetchMoreForQueryId) {
            // XXX We don't write fetchMore results to the store because this would overwrite
            // the original result in case an @connection directive is used.
            resultFromStore = result.data;
          } else {
            try {
              // ensure result is combined with data already in store
              // this will throw an error if there are missing fields in
              // the results if returnPartialData is false.
              resultFromStore = this.dataStore.getCache().read({
                variables,
                query: document,
                optimistic: false,
              });
              // ensure multiple errors don't get thrown
              /* tslint:disable */
            } catch (e) {}
            /* tslint:enable */
          }

          // return a chainable promise
          this.removeFetchQueryPromise(requestId);
          resolve({
            data: resultFromStore,
            loading: false,
            networkStatus: NetworkStatus.ready,
            stale: false,
          });
          return Promise.resolve();
        })
        .catch((error: Error) => {
          reject(error);
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
      console.warn(
        `Warning: unknown query with name ${queryName} asked to refetch`,
      );
      return;
    } else {
      return Promise.all(
        refetchedQueries.map(queryId =>
          this.observableQueries[queryId].observableQuery.refetch(),
        ),
      );
    }
  }

  private generateRequestId() {
    const requestId = this.idCounter;
    this.idCounter++;
    return requestId;
  }
}
