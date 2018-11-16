import { execute, ApolloLink, FetchResult } from 'apollo-link';
import { ExecutionResult, DocumentNode } from 'graphql';
import { print } from 'graphql/language/printer';
import { DedupLink as Deduplicator } from 'apollo-link-dedup';
import { Cache } from 'apollo-cache';
import {
  assign,
  getDefaultValues,
  getMutationDefinition,
  getOperationDefinition,
  getOperationName,
  getQueryDefinition,
  isProduction,
  hasDirectives,
} from 'apollo-utilities';

import { QueryScheduler } from '../scheduler/scheduler';

import { isApolloError, ApolloError } from '../errors/ApolloError';

import { Observer, Subscription, Observable } from '../util/Observable';

import { QueryWithUpdater, DataStore } from '../data/store';
import { MutationStore } from '../data/mutations';
import { QueryStore, QueryStoreValue } from '../data/queries';

import {
  QueryOptions,
  WatchQueryOptions,
  SubscriptionOptions,
  MutationOptions,
} from './watchQueryOptions';
import { ObservableQuery } from './ObservableQuery';
import { NetworkStatus, isNetworkRequestInFlight } from './networkStatus';
import {
  QueryListener,
  ApolloQueryResult,
  FetchType,
  OperationVariables,
} from './types';
import { graphQLResultHasError } from 'apollo-utilities';

export interface QueryInfo {
  listeners: QueryListener[];
  invalidated: boolean;
  newData: Cache.DiffResult<any> | null;
  document: DocumentNode | null;
  lastRequestId: number | null;
  // A map going from queryId to an observer for a query issued by watchQuery. We use
  // these to keep track of queries that are inflight and error on the observers associated
  // with them in case of some destabalizing action (e.g. reset of the Apollo store).
  observableQuery: ObservableQuery<any> | null;
  subscriptions: Subscription[];
  cancel?: (() => void);
}

export interface QueryPromise {
  resolve: (result: ApolloQueryResult<any>) => void;
  reject: (error: Error) => void;
}

export class QueryManager<TStore> {
  public scheduler: QueryScheduler<TStore>;
  public link: ApolloLink;
  public mutationStore: MutationStore = new MutationStore();
  public queryStore: QueryStore = new QueryStore();
  public dataStore: DataStore<TStore>;

  private deduplicator: ApolloLink;
  private queryDeduplication: boolean;

  private onBroadcast: () => void;

  // let's not start at zero to avoid pain with bad checks
  private idCounter = 1;

  // XXX merge with ObservableQuery but that needs to be expanded to support mutations and
  // subscriptions as well
  private queries: Map<string, QueryInfo> = new Map();

  // A map going from a requestId to a promise that has not yet been resolved. We use this to keep
  // track of queries that are inflight and reject them in case some
  // destabalizing action occurs (e.g. reset of the Apollo store).
  private fetchQueryPromises: Map<string, QueryPromise> = new Map();

  // A map going from the name of a query to an observer issued for it by watchQuery. This is
  // generally used to refetches for refetchQueries and to update mutation results through
  // updateQueries.
  private queryIdsByName: { [queryName: string]: string[] } = {};

  constructor({
    link,
    queryDeduplication = false,
    store,
    onBroadcast = () => undefined,
    ssrMode = false,
  }: {
    link: ApolloLink;
    queryDeduplication?: boolean;
    store: DataStore<TStore>;
    onBroadcast?: () => void;
    ssrMode?: boolean;
  }) {
    this.link = link;
    this.deduplicator = ApolloLink.from([new Deduplicator(), link]);
    this.queryDeduplication = queryDeduplication;
    this.dataStore = store;
    this.onBroadcast = onBroadcast;

    this.scheduler = new QueryScheduler({ queryManager: this, ssrMode });
  }

  public mutate<T>({
    mutation,
    variables,
    optimisticResponse,
    updateQueries: updateQueriesByName,
    refetchQueries = [],
    awaitRefetchQueries = false,
    update: updateWithProxyFn,
    errorPolicy = 'none',
    fetchPolicy,
    context = {},
  }: MutationOptions): Promise<FetchResult<T>> {
    if (!mutation) {
      throw new Error(
        'mutation option is required. You must specify your GraphQL document in the mutation option.',
      );
    }

    if (fetchPolicy && fetchPolicy !== 'no-cache') {
      throw new Error(
        "fetchPolicy for mutations currently only supports the 'no-cache' policy",
      );
    }

    const mutationId = this.generateQueryId();
    const cache = this.dataStore.getCache();
    (mutation = cache.transformDocument(mutation)),
      (variables = assign(
        {},
        getDefaultValues(getMutationDefinition(mutation)),
        variables,
      ));
    const mutationString = print(mutation);

    this.setQuery(mutationId, () => ({ document: mutation }));

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

    return new Promise((resolve, reject) => {
      let storeResult: FetchResult<T> | null;
      let error: ApolloError;

      const operation = this.buildOperationForLink(mutation, variables, {
        ...context,
        optimisticResponse,
      });

      const completeMutation = async () => {
        if (error) {
          this.mutationStore.markMutationError(mutationId, error);
        }

        this.dataStore.markMutationComplete({
          mutationId,
          optimisticResponse,
        });

        this.broadcastQueries();

        if (error) {
          throw error;
        }

        // allow for conditional refetches
        // XXX do we want to make this the only API one day?
        if (typeof refetchQueries === 'function') {
          refetchQueries = refetchQueries(storeResult as ExecutionResult);
        }

        const refetchQueryPromises: Promise<
          ApolloQueryResult<any>[] | ApolloQueryResult<{}>
        >[] = [];

        for (const refetchQuery of refetchQueries) {
          if (typeof refetchQuery === 'string') {
            const promise = this.refetchQueryByName(refetchQuery);
            if (promise) {
              refetchQueryPromises.push(promise);
            }
            continue;
          }

          const queryOptions: QueryOptions = {
            query: refetchQuery.query,
            variables: refetchQuery.variables,
            fetchPolicy: 'network-only',
          };

          if (refetchQuery.context) {
            queryOptions.context = refetchQuery.context;
          }

          refetchQueryPromises.push(this.query(queryOptions));
        }

        if (awaitRefetchQueries) {
          await Promise.all(refetchQueryPromises);
        }

        this.setQuery(mutationId, () => ({ document: undefined }));
        if (
          errorPolicy === 'ignore' &&
          storeResult &&
          graphQLResultHasError(storeResult)
        ) {
          delete storeResult.errors;
        }

        return storeResult as FetchResult<T>;
      };

      execute(this.link, operation).subscribe({
        next: (result: ExecutionResult) => {
          if (graphQLResultHasError(result) && errorPolicy === 'none') {
            error = new ApolloError({
              graphQLErrors: result.errors,
            });
            return;
          }

          this.mutationStore.markMutationResult(mutationId);

          if (fetchPolicy !== 'no-cache') {
            this.dataStore.markMutationResult({
              mutationId,
              result,
              document: mutation,
              variables: variables || {},
              updateQueries: generateUpdateQueriesInfo(),
              update: updateWithProxyFn,
            });
          }
          storeResult = result as FetchResult<T>;
        },

        error: (err: Error) => {
          this.mutationStore.markMutationError(mutationId, err);
          this.dataStore.markMutationComplete({
            mutationId,
            optimisticResponse,
          });
          this.broadcastQueries();

          this.setQuery(mutationId, () => ({ document: undefined }));
          reject(
            new ApolloError({
              networkError: err,
            }),
          );
        },

        complete: () => completeMutation().then(resolve, reject),
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
  ): Promise<FetchResult<T>> {
    const {
      variables = {},
      metadata = null,
      fetchPolicy = 'cache-first', // cache-first is the default fetch policy.
    } = options;
    const cache = this.dataStore.getCache();

    const query = cache.transformDocument(options.query);

    let storeResult: any;
    let needToFetch: boolean =
      fetchPolicy === 'network-only' || fetchPolicy === 'no-cache';

    // If this is not a force fetch, we want to diff the query against the
    // store before we fetch it from the network interface.
    // TODO we hit the cache even if the policy is network-first. This could be unnecessary if the network is up.
    if (
      fetchType !== FetchType.refetch &&
      fetchPolicy !== 'network-only' &&
      fetchPolicy !== 'no-cache'
    ) {
      const { complete, result } = this.dataStore.getCache().diff({
        query,
        variables,
        returnPartialData: true,
        optimistic: false,
      });

      // If we're in here, only fetch if we have missing fields
      needToFetch = !complete || fetchPolicy === 'cache-and-network';
      storeResult = result;
    }

    let shouldFetch =
      needToFetch && fetchPolicy !== 'cache-only' && fetchPolicy !== 'standby';

    // we need to check to see if this is an operation that uses the @live directive
    if (hasDirectives(['live'], query)) shouldFetch = true;

    const requestId = this.generateRequestId();

    // set up a watcher to listen to cache updates
    const cancel = this.updateQueryWatch(queryId, query, options);

    // Initialize query in store with unique requestId
    this.setQuery(queryId, () => ({
      document: query,
      lastRequestId: requestId,
      invalidated: true,
      cancel,
    }));

    this.invalidate(true, fetchMoreForQueryId);

    this.queryStore.initQuery({
      queryId,
      document: query,
      storePreviousVariables: shouldFetch,
      variables,
      isPoll: fetchType === FetchType.poll,
      isRefetch: fetchType === FetchType.refetch,
      metadata,
      fetchMoreForQueryId,
    });

    this.broadcastQueries();

    // If there is no part of the query we need to fetch from the server (or,
    // fetchPolicy is cache-only), we just write the store result as the final result.
    const shouldDispatchClientResult =
      !shouldFetch || fetchPolicy === 'cache-and-network';

    if (shouldDispatchClientResult) {
      this.queryStore.markQueryResultClient(queryId, !shouldFetch);

      this.invalidate(true, queryId, fetchMoreForQueryId);

      this.broadcastQueries();
    }

    if (shouldFetch) {
      const networkResult = this.fetchRequest({
        requestId,
        queryId,
        document: query,
        options,
        fetchMoreForQueryId,
      }).catch(error => {
        // This is for the benefit of `refetch` promises, which currently don't get their errors
        // through the store like watchQuery observers do
        if (isApolloError(error)) {
          throw error;
        } else {
          const { lastRequestId } = this.getQuery(queryId);
          if (requestId >= (lastRequestId || 1)) {
            this.queryStore.markQueryError(queryId, error, fetchMoreForQueryId);

            this.invalidate(true, queryId, fetchMoreForQueryId);

            this.broadcastQueries();
          }

          this.removeFetchQueryPromise(requestId);

          throw new ApolloError({ networkError: error });
        }
      });

      // we don't return the promise for cache-and-network since it is already
      // returned below from the cache
      if (fetchPolicy !== 'cache-and-network') {
        return networkResult;
      } else {
        // however we need to catch the error so it isn't unhandled in case of
        // network error
        networkResult.catch(() => {});
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
    return (
      queryStoreValue: QueryStoreValue,
      newData?: Cache.DiffResult<T>,
    ) => {
      // we're going to take a look at the data, so the query is no longer invalidated
      this.invalidate(false, queryId);

      // The query store value can be undefined in the event of a store
      // reset.
      if (!queryStoreValue) return;

      const { observableQuery } = this.getQuery(queryId);

      const fetchPolicy = observableQuery
        ? observableQuery.options.fetchPolicy
        : options.fetchPolicy;

      // don't watch the store for queries on standby
      if (fetchPolicy === 'standby') return;

      const errorPolicy = observableQuery
        ? observableQuery.options.errorPolicy
        : options.errorPolicy;

      const lastResult = observableQuery
        ? observableQuery.getLastResult()
        : null;

      const lastError = observableQuery ? observableQuery.getLastError() : null;

      let shouldNotifyIfLoading =
        (!newData && queryStoreValue.previousVariables != null) ||
        fetchPolicy === 'cache-only' ||
        fetchPolicy === 'cache-and-network';

      // if this caused by a cache broadcast but the query is still in flight
      // don't notify the observer
      // if (
      //   isCacheBroadcast &&
      //   isNetworkRequestInFlight(queryStoreValue.networkStatus)
      // ) {
      //   shouldNotifyIfLoading = false;
      // }

      const networkStatusChanged = Boolean(
        lastResult &&
          queryStoreValue.networkStatus !== lastResult.networkStatus,
      );

      const errorStatusChanged =
        errorPolicy &&
        (lastError && lastError.graphQLErrors) !==
          queryStoreValue.graphQLErrors &&
        errorPolicy !== 'none';

      if (
        !isNetworkRequestInFlight(queryStoreValue.networkStatus) ||
        (networkStatusChanged && options.notifyOnNetworkStatusChange) ||
        shouldNotifyIfLoading
      ) {
        // If we have either a GraphQL error or a network error, we create
        // an error and tell the observer about it.
        if (
          ((!errorPolicy || errorPolicy === 'none') &&
            queryStoreValue.graphQLErrors &&
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
                  print(queryStoreValue.document),
              );
            }
          }
          return;
        }

        try {
          let data: any;
          let isMissing: boolean;

          if (newData) {
            // As long as we're using the cache, clear out the latest
            // `newData`, since it will now become the current data. We need
            // to keep the `newData` stored with the query when using
            // `no-cache` since `getCurrentQueryResult` attemps to pull from
            // `newData` first, following by trying the cache (which won't
            // find a hit for `no-cache`).
            if (fetchPolicy !== 'no-cache') {
              this.setQuery(queryId, () => ({ newData: null }));
            }

            data = newData.result;
            isMissing = !newData.complete || false;
          } else {
            if (lastResult && lastResult.data && !errorStatusChanged) {
              data = lastResult.data;
              isMissing = false;
            } else {
              const { document } = this.getQuery(queryId);
              const readResult = this.dataStore.getCache().diff({
                query: document as DocumentNode,
                variables:
                  queryStoreValue.previousVariables ||
                  queryStoreValue.variables,
                optimistic: true,
              });

              data = readResult.result;
              isMissing = !readResult.complete;
            }
          }

          let resultFromStore: ApolloQueryResult<T>;

          // If there is some data missing and the user has told us that they
          // do not tolerate partial data then we want to return the previous
          // result and mark it as stale.
          if (isMissing && fetchPolicy !== 'cache-only') {
            resultFromStore = {
              data: lastResult && lastResult.data,
              loading: isNetworkRequestInFlight(queryStoreValue.networkStatus),
              networkStatus: queryStoreValue.networkStatus,
              stale: true,
            };
          } else {
            resultFromStore = {
              data,
              loading: isNetworkRequestInFlight(queryStoreValue.networkStatus),
              networkStatus: queryStoreValue.networkStatus,
              stale: false,
            };
          }

          // if the query wants updates on errors we need to add it to the result
          if (
            errorPolicy === 'all' &&
            queryStoreValue.graphQLErrors &&
            queryStoreValue.graphQLErrors.length > 0
          ) {
            resultFromStore.errors = queryStoreValue.graphQLErrors;
          }

          if (observer.next) {
            if (previouslyHadError ||
                !observableQuery ||
                observableQuery.isDifferentFromLastResult(resultFromStore)) {
              try {
                observer.next(resultFromStore);
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
          if (observer.error)
            observer.error(new ApolloError({ networkError: error }));
          return;
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

    return new ObservableQuery<T>({
      scheduler: this.scheduler,
      options: transformedOptions,
      shouldSubscribe: shouldSubscribe,
    });
  }

  public query<T>(options: QueryOptions): Promise<ApolloQueryResult<T>> {
    if (!options.query) {
      throw new Error(
        'query option is required. You must specify your GraphQL document ' +
          'in the query option.',
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

    const requestId = this.idCounter;

    return new Promise<ApolloQueryResult<T>>((resolve, reject) => {
      this.addFetchQueryPromise<T>(requestId, resolve, reject);

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
  }

  public generateQueryId() {
    const queryId = this.idCounter.toString();
    this.idCounter++;
    return queryId;
  }

  public stopQueryInStore(queryId: string) {
    this.queryStore.stopQuery(queryId);
    this.invalidate(true, queryId);
    this.broadcastQueries();
  }

  public addQueryListener(queryId: string, listener: QueryListener) {
    this.setQuery(queryId, ({ listeners = [] }) => ({
      listeners: listeners.concat([listener]),
      invalidate: false,
    }));
  }

  public updateQueryWatch(
    queryId: string,
    document: DocumentNode,
    options: WatchQueryOptions,
  ) {
    const { cancel } = this.getQuery(queryId);
    if (cancel) cancel();
    const previousResult = () => {
      let previousResult = null;
      const { observableQuery } = this.getQuery(queryId);
      if (observableQuery) {
        const lastResult = observableQuery.getLastResult();
        if (lastResult) {
          previousResult = lastResult.data;
        }
      }

      return previousResult;
    };
    return this.dataStore.getCache().watch({
      query: document as DocumentNode,
      variables: options.variables,
      optimistic: true,
      previousResult,
      callback: (newData: ApolloQueryResult<any>) => {
        this.setQuery(queryId, () => ({ invalidated: true, newData }));
      },
    });
  }

  // Adds a promise to this.fetchQueryPromises for a given request ID.
  public addFetchQueryPromise<T>(
    requestId: number,
    resolve: (result: ApolloQueryResult<T>) => void,
    reject: (error: Error) => void,
  ) {
    this.fetchQueryPromises.set(requestId.toString(), {
      resolve,
      reject,
    });
  }

  // Removes the promise in this.fetchQueryPromises for a particular request ID.
  public removeFetchQueryPromise(requestId: number) {
    this.fetchQueryPromises.delete(requestId.toString());
  }

  // Adds an ObservableQuery to this.observableQueries and to this.observableQueriesByName.
  public addObservableQuery<T>(
    queryId: string,
    observableQuery: ObservableQuery<T>,
  ) {
    this.setQuery(queryId, () => ({ observableQuery }));

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
    const { observableQuery, cancel } = this.getQuery(queryId);
    if (cancel) cancel();
    if (!observableQuery) return;

    const definition = getQueryDefinition(observableQuery.options.query);
    const queryName = definition.name ? definition.name.value : null;
    this.setQuery(queryId, () => ({ observableQuery: null }));
    if (queryName) {
      this.queryIdsByName[queryName] = this.queryIdsByName[queryName].filter(
        val => {
          return !(observableQuery.queryId === val);
        },
      );
    }
  }

  public clearStore(): Promise<void> {
    // Before we have sent the reset action to the store,
    // we can no longer rely on the results returned by in-flight
    // requests since these may depend on values that previously existed
    // in the data portion of the store. So, we cancel the promises and observers
    // that we have issued so far and not yet resolved (in the case of
    // queries).
    this.fetchQueryPromises.forEach(({ reject }) => {
      reject(
        new Error(
          'Store reset while query was in flight(not completed in link chain)',
        ),
      );
    });

    const resetIds: string[] = [];
    this.queries.forEach(({ observableQuery }, queryId) => {
      if (observableQuery) resetIds.push(queryId);
    });

    this.queryStore.reset(resetIds);
    this.mutationStore.reset();

    // begin removing data from the store
    const reset = this.dataStore.reset();
    return reset;
  }

  public resetStore(): Promise<ApolloQueryResult<any>[]> {
    // Similarly, we have to have to refetch each of the queries currently being
    // observed. We refetch instead of error'ing on these since the assumption is that
    // resetting the store doesn't eliminate the need for the queries currently being
    // watched. If there is an existing query in flight when the store is reset,
    // the promise for it will be rejected and its results will not be written to the
    // store.
    return this.clearStore().then(() => {
      return this.reFetchObservableQueries();
    });
  }

  public reFetchObservableQueries(
    includeStandby?: boolean,
  ): Promise<ApolloQueryResult<any>[]> {
    const observableQueryPromises: Promise<
      ApolloQueryResult<any>
    >[] = this.getObservableQueryPromises(includeStandby);

    this.broadcastQueries();

    return Promise.all(observableQueryPromises);
  }

  public startQuery<T>(
    queryId: string,
    options: WatchQueryOptions,
    listener: QueryListener,
  ) {
    this.addQueryListener(queryId, listener);

    this.fetchQuery<T>(queryId, options)
      // `fetchQuery` returns a Promise. In case of a failure it should be caucht or else the
      // console will show an `Uncaught (in promise)` message. Ignore the error for now.
      .catch(() => undefined);

    return queryId;
  }

  public startGraphQLSubscription(
    options: SubscriptionOptions,
  ): Observable<any> {
    const { query } = options;
    const isCacheEnabled = !(
      options.fetchPolicy && options.fetchPolicy === 'no-cache'
    );
    const cache = this.dataStore.getCache();
    let transformedDoc = cache.transformDocument(query);

    const variables = assign(
      {},
      getDefaultValues(getOperationDefinition(query)),
      options.variables,
    );

    let sub: Subscription;
    let observers: Observer<any>[] = [];

    return new Observable(observer => {
      observers.push(observer);

      // If this is the first observer, actually initiate the network
      // subscription.
      if (observers.length === 1) {
        const handler = {
          next: (result: FetchResult) => {
            if (isCacheEnabled) {
              this.dataStore.markSubscriptionResult(
                result,
                transformedDoc,
                variables,
              );
              this.broadcastQueries();
            }

            observers.forEach(obs => {
              // If an error exists and a `error` handler has been defined on
              // the observer, call that `error` handler and make sure the
              // `next` handler is skipped. If no `error` handler exists, we're
              // still passing any errors that might occur into the `next`
              // handler, to give that handler a chance to deal with the
              // error (we're doing this for backwards compatibilty).
              if (graphQLResultHasError(result) && obs.error) {
                obs.error(
                  new ApolloError({
                    graphQLErrors: result.errors,
                  }),
                );
              } else if (obs.next) {
                obs.next(result);
              }
            });
          },
          error: (error: Error) => {
            observers.forEach(obs => {
              if (obs.error) {
                obs.error(error);
              }
            });
          },
        };

        // TODO: Should subscriptions also accept a `context` option to pass
        // through to links?
        const operation = this.buildOperationForLink(transformedDoc, variables);
        sub = execute(this.link, operation).subscribe(handler);
      }

      return () => {
        observers = observers.filter(obs => obs !== observer);

        // If we removed the last observer, tear down the network subscription
        if (observers.length === 0 && sub) {
          sub.unsubscribe();
        }
      };
    });
  }

  public stopQuery(queryId: string) {
    this.stopQueryInStore(queryId);
    this.removeQuery(queryId);
  }

  public removeQuery(queryId: string) {
    const { subscriptions } = this.getQuery(queryId);
    // teardown all links
    subscriptions.forEach(x => x.unsubscribe());
    this.queries.delete(queryId);
  }

  public getCurrentQueryResult<T>(
    observableQuery: ObservableQuery<T>,
    optimistic: boolean = true,
  ) {
    const { variables, query } = observableQuery.options;
    const lastResult = observableQuery.getLastResult();
    const { newData } = this.getQuery(observableQuery.queryId);
    // XXX test this
    if (newData && newData.complete) {
      return { data: newData.result, partial: false };
    } else {
      try {
        // the query is brand new, so we read from the store to see if anything is there
        const data = this.dataStore.getCache().read({
          query,
          variables,
          previousResult: lastResult ? lastResult.data : undefined,
          optimistic,
        });

        return { data, partial: false };
      } catch (e) {
        return { data: {}, partial: true };
      }
    }
  }

  public getQueryWithPreviousResult<T>(
    queryIdOrObservable: string | ObservableQuery<T>,
  ): {
    previousResult: any;
    variables: OperationVariables | undefined;
    document: DocumentNode;
  } {
    let observableQuery: ObservableQuery<T>;
    if (typeof queryIdOrObservable === 'string') {
      const { observableQuery: foundObserveableQuery } = this.getQuery(
        queryIdOrObservable,
      );
      if (!foundObserveableQuery) {
        throw new Error(
          `ObservableQuery with this id doesn't exist: ${queryIdOrObservable}`,
        );
      }
      observableQuery = foundObserveableQuery;
    } else {
      observableQuery = queryIdOrObservable;
    }

    const { variables, query } = observableQuery.options;

    const { data } = this.getCurrentQueryResult(observableQuery, false);

    return {
      previousResult: data,
      variables,
      document: query,
    };
  }

  public broadcastQueries() {
    this.onBroadcast();
    this.queries.forEach((info, id) => {
      if (!info.invalidated || !info.listeners) return;
      info.listeners
        // it's possible for the listener to be undefined if the query is being stopped
        // See here for more detail: https://github.com/apollostack/apollo-client/issues/231
        .filter((x: QueryListener) => !!x)
        .forEach((listener: QueryListener) => {
          listener(this.queryStore.get(id), info.newData);
        });
    });
  }

  private getObservableQueryPromises(
    includeStandby?: boolean,
  ): Promise<ApolloQueryResult<any>>[] {
    const observableQueryPromises: Promise<ApolloQueryResult<any>>[] = [];
    this.queries.forEach(({ observableQuery }, queryId) => {
      if (!observableQuery) return;
      const fetchPolicy = observableQuery.options.fetchPolicy;

      observableQuery.resetLastResults();
      if (
        fetchPolicy !== 'cache-only' &&
        (includeStandby || fetchPolicy !== 'standby')
      ) {
        observableQueryPromises.push(observableQuery.refetch());
      }

      this.setQuery(queryId, () => ({ newData: null }));
      this.invalidate(true, queryId);
    });

    return observableQueryPromises;
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
    const { variables, context, errorPolicy = 'none', fetchPolicy } = options;
    const operation = this.buildOperationForLink(document, variables, {
      ...context,
      // TODO: Should this be included for all entry points via
      // buildOperationForLink?
      forceFetch: !this.queryDeduplication,
    });

    let resultFromStore: any;
    let errorsFromStore: any;

    return new Promise<ApolloQueryResult<T>>((resolve, reject) => {
      this.addFetchQueryPromise<T>(requestId, resolve, reject);
      const subscription = execute(this.deduplicator, operation).subscribe({
        next: (result: ExecutionResult) => {
          // default the lastRequestId to 1
          const { lastRequestId } = this.getQuery(queryId);
          if (requestId >= (lastRequestId || 1)) {
            if (fetchPolicy !== 'no-cache') {
              try {
                this.dataStore.markQueryResult(
                  result,
                  document,
                  variables,
                  fetchMoreForQueryId,
                  errorPolicy === 'ignore' || errorPolicy === 'all',
                );
              } catch (e) {
                reject(e);
                return;
              }
            } else {
              this.setQuery(queryId, () => ({
                newData: { result: result.data, complete: true },
              }));
            }

            this.queryStore.markQueryResult(
              queryId,
              result,
              fetchMoreForQueryId,
            );

            this.invalidate(true, queryId, fetchMoreForQueryId);

            this.broadcastQueries();
          }

          if (result.errors && errorPolicy === 'none') {
            reject(
              new ApolloError({
                graphQLErrors: result.errors,
              }),
            );
            return;
          } else if (errorPolicy === 'all') {
            errorsFromStore = result.errors;
          }

          if (fetchMoreForQueryId || fetchPolicy === 'no-cache') {
            // We don't write fetchMore results to the store because this would overwrite
            // the original result in case an @connection directive is used.
            resultFromStore = result.data;
          } else {
            try {
              // ensure result is combined with data already in store
              resultFromStore = this.dataStore.getCache().read({
                variables,
                query: document,
                optimistic: false,
              });
              // this will throw an error if there are missing fields in
              // the results which can happen with errors from the server.
              // tslint:disable-next-line
            } catch (e) {}
          }
        },
        error: (error: ApolloError) => {
          this.removeFetchQueryPromise(requestId);
          this.setQuery(queryId, ({ subscriptions }) => ({
            subscriptions: subscriptions.filter(x => x !== subscription),
          }));

          reject(error);
        },
        complete: () => {
          this.removeFetchQueryPromise(requestId);
          this.setQuery(queryId, ({ subscriptions }) => ({
            subscriptions: subscriptions.filter(x => x !== subscription),
          }));

          resolve({
            data: resultFromStore,
            errors: errorsFromStore,
            loading: false,
            networkStatus: NetworkStatus.ready,
            stale: false,
          });
        },
      });

      this.setQuery(queryId, ({ subscriptions }) => ({
        subscriptions: subscriptions.concat([subscription]),
      }));
    });
  }

  // Refetches a query given that query's name. Refetches
  // all ObservableQuery instances associated with the query name.
  private refetchQueryByName(queryName: string) {
    const refetchedQueries = this.queryIdsByName[queryName];
    // early return if the query named does not exist (not yet fetched)
    // this used to warn but it may be inteneded behavoir to try and refetch
    // un called queries because they could be on different routes
    if (refetchedQueries === undefined) return;
    return Promise.all(
      refetchedQueries
        .map(id => this.getQuery(id).observableQuery)
        .filter(x => !!x)
        .map((x: ObservableQuery<any>) => x.refetch()),
    );
  }

  private generateRequestId() {
    const requestId = this.idCounter;
    this.idCounter++;
    return requestId;
  }

  private getQuery(queryId: string) {
    return this.queries.get(queryId) || {
      listeners: [],
      invalidated: false,
      document: null,
      newData: null,
      lastRequestId: null,
      observableQuery: null,
      subscriptions: [],
    };
  }

  private setQuery(queryId: string, updater: (prev: QueryInfo) => any) {
    const prev = this.getQuery(queryId);
    const newInfo = { ...prev, ...updater(prev) };
    this.queries.set(queryId, newInfo);
  }

  private invalidate(
    invalidated: boolean,
    queryId?: string,
    fetchMoreForQueryId?: string,
  ) {
    if (queryId) this.setQuery(queryId, () => ({ invalidated }));

    if (fetchMoreForQueryId) {
      this.setQuery(fetchMoreForQueryId, () => ({ invalidated }));
    }
  }

  private buildOperationForLink(
    document: DocumentNode,
    variables: any,
    extraContext?: any,
  ) {
    const cache = this.dataStore.getCache();

    return {
      query: cache.transformForLink
        ? cache.transformForLink(document)
        : document,
      variables,
      operationName: getOperationName(document) || undefined,
      context: {
        ...extraContext,
        cache,
        // getting an entry's cache key is useful for cacheResolvers & state-link
        getCacheKey: (obj: { __typename: string; id: string | number }) => {
          if ((cache as any).config) {
            // on the link, we just want the id string, not the full id value from toIdValue
            return (cache as any).config.dataIdFromObject(obj);
          } else {
            throw new Error(
              'To use context.getCacheKey, you need to use a cache that has a configurable dataIdFromObject, like apollo-cache-inmemory.',
            );
          }
        },
      },
    };
  }
}
