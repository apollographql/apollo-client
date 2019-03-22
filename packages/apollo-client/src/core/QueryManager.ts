import { execute, ApolloLink, FetchResult } from 'apollo-link';
import { ExecutionResult, DocumentNode } from 'graphql';
import { Cache } from 'apollo-cache';
import {
  getDefaultValues,
  getOperationDefinition,
  getOperationName,
  hasDirectives,
  graphQLResultHasError,
  hasClientExports,
  removeConnectionDirectiveFromDocument,
  canUseWeakMap,
} from 'apollo-utilities';

import { invariant, InvariantError } from 'ts-invariant';

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
import { LocalState } from './LocalState';
import { asyncMap, multiplex } from '../util/observables';

const { hasOwnProperty } = Object.prototype;

export interface QueryInfo {
  listeners: Set<QueryListener>;
  invalidated: boolean;
  newData: Cache.DiffResult<any> | null;
  document: DocumentNode | null;
  lastRequestId: number;
  // A map going from queryId to an observer for a query issued by watchQuery. We use
  // these to keep track of queries that are inflight and error on the observers associated
  // with them in case of some destabalizing action (e.g. reset of the Apollo store).
  observableQuery: ObservableQuery<any> | null;
  subscriptions: Set<Subscription>;
  cancel?: () => void;
}

export class QueryManager<TStore> {
  public link: ApolloLink;
  public mutationStore: MutationStore = new MutationStore();
  public queryStore: QueryStore = new QueryStore();
  public dataStore: DataStore<TStore>;
  public readonly assumeImmutableResults: boolean;

  private queryDeduplication: boolean;
  private clientAwareness: Record<string, string> = {};
  private localState: LocalState<TStore>;

  private onBroadcast: () => void;

  private ssrMode: boolean;

  // let's not start at zero to avoid pain with bad checks
  private idCounter = 1;

  // XXX merge with ObservableQuery but that needs to be expanded to support mutations and
  // subscriptions as well
  private queries: Map<string, QueryInfo> = new Map();

  // A map of Promise reject functions for fetchQuery promises that have not
  // yet been resolved, used to keep track of in-flight queries so that we can
  // reject them in case a destabilizing event occurs (e.g. Apollo store reset).
  // The key is in the format of `query:${queryId}` or `fetchRequest:${queryId}`,
  // depending on where the promise's rejection function was created from.
  private fetchQueryRejectFns = new Map<string, Function>();

  constructor({
    link,
    queryDeduplication = false,
    store,
    onBroadcast = () => undefined,
    ssrMode = false,
    clientAwareness = {},
    localState,
    assumeImmutableResults,
  }: {
    link: ApolloLink;
    queryDeduplication?: boolean;
    store: DataStore<TStore>;
    onBroadcast?: () => void;
    ssrMode?: boolean;
    clientAwareness?: Record<string, string>;
    localState?: LocalState<TStore>;
    assumeImmutableResults?: boolean;
  }) {
    this.link = link;
    this.queryDeduplication = queryDeduplication;
    this.dataStore = store;
    this.onBroadcast = onBroadcast;
    this.clientAwareness = clientAwareness;
    this.localState = localState || new LocalState({ cache: store.getCache() });
    this.ssrMode = ssrMode;
    this.assumeImmutableResults = !!assumeImmutableResults;
  }

  /**
   * Call this method to terminate any active query processes, making it safe
   * to dispose of this QueryManager instance.
   */
  public stop() {
    this.queries.forEach((_info, queryId) => {
      this.stopQueryNoBroadcast(queryId);
    });

    this.fetchQueryRejectFns.forEach(reject => {
      reject(
        new InvariantError('QueryManager stopped while query was in flight'),
      );
    });
  }

  public async mutate<T>({
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
    invariant(
      mutation,
      'mutation option is required. You must specify your GraphQL document in the mutation option.',
    );

    invariant(
      !fetchPolicy || fetchPolicy === 'no-cache',
      "fetchPolicy for mutations currently only supports the 'no-cache' policy"
    );

    const mutationId = this.generateQueryId();
    mutation = this.transform(mutation).document;

    this.setQuery(mutationId, () => ({ document: mutation }));

    variables = this.getVariables(mutation, variables);

    if (this.transform(mutation).hasClientExports) {
      variables = await this.localState.addExportedVariables(mutation, variables, context);
    }

    // Create a map of update queries by id to the query instead of by name.
    const generateUpdateQueriesInfo: () => {
      [queryId: string]: QueryWithUpdater;
    } = () => {
      const ret: { [queryId: string]: QueryWithUpdater } = {};

      if (updateQueriesByName) {
        this.queries.forEach(({ observableQuery }, queryId) => {
          if (observableQuery) {
            const { queryName } = observableQuery;
            if (
              queryName &&
              hasOwnProperty.call(updateQueriesByName, queryName)
            ) {
              ret[queryId] = {
                updater: updateQueriesByName[queryName],
                query: this.queryStore.get(queryId),
              };
            }
          }
        });
      }

      return ret;
    };

    this.mutationStore.initMutation(
      mutationId,
      mutation,
      variables,
    );

    this.dataStore.markMutationInit({
      mutationId,
      document: mutation,
      variables,
      updateQueries: generateUpdateQueriesInfo(),
      update: updateWithProxyFn,
      optimisticResponse,
    });

    this.broadcastQueries();

    const self = this;

    return new Promise((resolve, reject) => {
      let storeResult: FetchResult<T> | null;
      let error: ApolloError;

      self.getObservableFromLink(
        mutation,
        {
          ...context,
          optimisticResponse,
        },
        variables,
        false,
      ).subscribe({
        next(result: ExecutionResult) {
          if (graphQLResultHasError(result) && errorPolicy === 'none') {
            error = new ApolloError({
              graphQLErrors: result.errors,
            });
            return;
          }

          self.mutationStore.markMutationResult(mutationId);

          if (fetchPolicy !== 'no-cache') {
            self.dataStore.markMutationResult({
              mutationId,
              result,
              document: mutation,
              variables,
              updateQueries: generateUpdateQueriesInfo(),
              update: updateWithProxyFn,
            });
          }

          storeResult = result as FetchResult<T>;
        },

        error(err: Error) {
          self.mutationStore.markMutationError(mutationId, err);
          self.dataStore.markMutationComplete({
            mutationId,
            optimisticResponse,
          });
          self.broadcastQueries();
          self.setQuery(mutationId, () => ({ document: null }));
          reject(
            new ApolloError({
              networkError: err,
            }),
          );
        },

        complete() {
          if (error) {
            self.mutationStore.markMutationError(mutationId, error);
          }

          self.dataStore.markMutationComplete({
            mutationId,
            optimisticResponse,
          });

          self.broadcastQueries();

          if (error) {
            reject(error);
            return;
          }

          // allow for conditional refetches
          // XXX do we want to make this the only API one day?
          if (typeof refetchQueries === 'function') {
            refetchQueries = refetchQueries(storeResult as ExecutionResult);
          }

          const refetchQueryPromises: Promise<
            ApolloQueryResult<any>[] | ApolloQueryResult<{}>
          >[] = [];

          refetchQueries.forEach(refetchQuery => {
            if (typeof refetchQuery === 'string') {
              self.queries.forEach(({ observableQuery }) => {
                if (
                  observableQuery &&
                  observableQuery.queryName === refetchQuery
                ) {
                  refetchQueryPromises.push(observableQuery.refetch());
                }
              });
            } else {
              const queryOptions: QueryOptions = {
                query: refetchQuery.query,
                variables: refetchQuery.variables,
                fetchPolicy: 'network-only',
              };

              if (refetchQuery.context) {
                queryOptions.context = refetchQuery.context;
              }

              refetchQueryPromises.push(self.query(queryOptions));
            }
          });

          Promise.all(
            awaitRefetchQueries ? refetchQueryPromises : [],
          ).then(() => {
            self.setQuery(mutationId, () => ({ document: null }));

            if (
              errorPolicy === 'ignore' &&
              storeResult &&
              graphQLResultHasError(storeResult)
            ) {
              delete storeResult.errors;
            }

            resolve(storeResult!);
          });
        },
      });
    });
  }

  public async fetchQuery<T>(
    queryId: string,
    options: WatchQueryOptions,
    fetchType?: FetchType,
    // This allows us to track if this is a query spawned by a `fetchMore`
    // call for another query. We need this data to compute the `fetchMore`
    // network status for the query this is fetching for.
    fetchMoreForQueryId?: string,
  ): Promise<FetchResult<T>> {
    const {
      metadata = null,
      fetchPolicy = 'cache-first', // cache-first is the default fetch policy.
      context = {},
    } = options;

    const query = this.transform(options.query).document;

    let variables = this.getVariables(query, options.variables);

    if (this.transform(query).hasClientExports) {
      variables = await this.localState.addExportedVariables(query, variables, context);
    }

    options = { ...options, variables };

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

    const requestId = this.idCounter++;

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

    if (shouldFetch) {
      const networkResult = this.fetchRequest<T>({
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
          if (requestId >= this.getQuery(queryId).lastRequestId) {
            this.queryStore.markQueryError(queryId, error, fetchMoreForQueryId);
            this.invalidate(true, queryId, fetchMoreForQueryId);
            this.broadcastQueries();
          }
          throw new ApolloError({ networkError: error });
        }
      });

      // we don't return the promise for cache-and-network since it is already
      // returned below from the cache
      if (fetchPolicy !== 'cache-and-network') {
        return networkResult;
      }

      // however we need to catch the error so it isn't unhandled in case of
      // network error
      networkResult.catch(() => {});
    }

    // If there is no part of the query we need to fetch from the server (or,
    // fetchPolicy is cache-only), we just write the store result as the final result.
    this.queryStore.markQueryResultClient(queryId, !shouldFetch);
    this.invalidate(true, queryId, fetchMoreForQueryId);

    if (this.transform(query).hasForcedResolvers) {
      return this.localState.runResolvers({
        document: query,
        remoteResult: { data: storeResult },
        context,
        variables,
        onlyRunForcedResolvers: true,
      }).then((result: FetchResult<T>) => {
        this.markQueryResult(
          queryId,
          result,
          options,
          fetchMoreForQueryId,
        );
        this.broadcastQueries();
        return result;
      });
    }

    this.broadcastQueries();

    // If we have no query to send to the server, we should return the result
    // found within the store.
    return { data: storeResult };
  }

  private markQueryResult(
    queryId: string,
    result: ExecutionResult,
    {
      fetchPolicy,
      variables,
      errorPolicy,
    }: WatchQueryOptions,
    fetchMoreForQueryId?: string,
  ) {
    if (fetchPolicy === 'no-cache') {
      this.setQuery(queryId, () => ({
        newData: { result: result.data, complete: true },
      }));
    } else {
      this.dataStore.markQueryResult(
        result,
        this.getQuery(queryId).document!,
        variables,
        fetchMoreForQueryId,
        errorPolicy === 'ignore' || errorPolicy === 'all',
      );
    }
  }

  // Returns a query listener that will update the given observer based on the
  // results (or lack thereof) for a particular query.
  public queryListenerForObserver<T>(
    queryId: string,
    options: WatchQueryOptions,
    observer: Observer<ApolloQueryResult<T>>,
  ): QueryListener {
    let previouslyHadError: boolean = false;
    return async (
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
            if (process.env.NODE_ENV !== 'production') {
              /* tslint:disable-next-line */
              console.info(
                'An unhandled error was thrown because no error handler is registered ' +
                  'for the query ' +
                  JSON.stringify(queryStoreValue.document),
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
            if (fetchPolicy !== 'no-cache' && fetchPolicy !== 'network-only') {
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
            if (
              previouslyHadError ||
              !observableQuery ||
              observableQuery.isDifferentFromLastResult(resultFromStore)
            ) {
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

  private transformCache = new (canUseWeakMap ? WeakMap : Map)<
    DocumentNode,
    Readonly<{
      document: Readonly<DocumentNode>;
      hasClientExports: boolean;
      hasForcedResolvers: boolean;
      clientQuery: Readonly<DocumentNode> | null;
      serverQuery: Readonly<DocumentNode> | null;
      defaultVars: Readonly<OperationVariables>;
    }>
  >();

  private transform(document: DocumentNode) {
    const { transformCache } = this;

    if (!transformCache.has(document)) {
      const cache = this.dataStore.getCache();
      const transformed = cache.transformDocument(document);
      const forLink = removeConnectionDirectiveFromDocument(
        cache.transformForLink(transformed));

      const clientQuery = this.localState.clientQuery(transformed);
      const serverQuery = this.localState.serverQuery(forLink);

      const cacheEntry = {
        document: transformed,
        // TODO These two calls (hasClientExports and shouldForceResolvers)
        // could probably be merged into a single traversal.
        hasClientExports: hasClientExports(transformed),
        hasForcedResolvers: this.localState.shouldForceResolvers(transformed),
        clientQuery,
        serverQuery,
        defaultVars: getDefaultValues(
          getOperationDefinition(transformed)
        ) as OperationVariables,
      };

      const add = (doc: DocumentNode | null) => {
        if (doc && !transformCache.has(doc)) {
          transformCache.set(doc, cacheEntry);
        }
      }
      // Add cacheEntry to the transformCache using several different keys,
      // since any one of these documents could end up getting passed to the
      // transform method again in the future.
      add(document);
      add(transformed);
      add(clientQuery);
      add(serverQuery);
    }

    return transformCache.get(document)!;
  }

  private getVariables(
    document: DocumentNode,
    variables?: OperationVariables,
  ): OperationVariables {
    return {
      ...this.transform(document).defaultVars,
      ...variables,
    };
  }

  // The shouldSubscribe option is a temporary fix that tells us whether watchQuery was called
  // directly (i.e. through ApolloClient) or through the query method within QueryManager.
  // Currently, the query method uses watchQuery in order to handle non-network errors correctly
  // but we don't want to keep track observables issued for the query method since those aren't
  // supposed to be refetched in the event of a store reset. Once we unify error handling for
  // network errors and non-network errors, the shouldSubscribe option will go away.

  public watchQuery<T, TVariables = OperationVariables>(
    options: WatchQueryOptions,
    shouldSubscribe = true,
  ): ObservableQuery<T, TVariables> {
    invariant(
      options.fetchPolicy !== 'standby',
      'client.watchQuery cannot be called with fetchPolicy set to "standby"',
    );

    // assign variable default values if supplied
    options.variables = this.getVariables(options.query, options.variables);

    if (typeof options.notifyOnNetworkStatusChange === 'undefined') {
      options.notifyOnNetworkStatusChange = false;
    }

    let transformedOptions = { ...options } as WatchQueryOptions<TVariables>;

    return new ObservableQuery<T, TVariables>({
      queryManager: this,
      options: transformedOptions,
      shouldSubscribe: shouldSubscribe,
    });
  }

  public query<T>(options: QueryOptions): Promise<ApolloQueryResult<T>> {
    invariant(
      options.query,
      'query option is required. You must specify your GraphQL document ' +
        'in the query option.',
    );

    invariant(
      options.query.kind === 'Document',
      'You must wrap the query string in a "gql" tag.',
    );

    invariant(
      !(options as any).returnPartialData,
      'returnPartialData option only supported on watchQuery.',
    );

    invariant(
      !(options as any).pollInterval,
      'pollInterval option only supported on watchQuery.',
    );

    return new Promise<ApolloQueryResult<T>>((resolve, reject) => {
      const watchedQuery = this.watchQuery<T>(options, false);
      this.fetchQueryRejectFns.set(`query:${watchedQuery.queryId}`, reject);
      watchedQuery
        .result()
        .then(resolve, reject)
        // Since neither resolve nor reject throw or return a value, this .then
        // handler is guaranteed to execute. Note that it doesn't really matter
        // when we remove the reject function from this.fetchQueryRejectFns,
        // since resolve and reject are mutually idempotent. In fact, it would
        // not be incorrect to let reject functions accumulate over time; it's
        // just a waste of memory.
        .then(() =>
          this.fetchQueryRejectFns.delete(`query:${watchedQuery.queryId}`),
        );
    });
  }

  public generateQueryId() {
    return String(this.idCounter++);
  }

  public stopQueryInStore(queryId: string) {
    this.stopQueryInStoreNoBroadcast(queryId);
    this.broadcastQueries();
  }

  private stopQueryInStoreNoBroadcast(queryId: string) {
    this.stopPollingQuery(queryId);
    this.queryStore.stopQuery(queryId);
    this.invalidate(true, queryId);
  }

  public addQueryListener(queryId: string, listener: QueryListener) {
    this.setQuery(queryId, ({ listeners }) => {
      listeners.add(listener);
      return { invalidated: false };
    });
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
      callback: newData => {
        this.setQuery(queryId, () => ({ invalidated: true, newData }));
      },
    });
  }

  // Adds an ObservableQuery to this.observableQueries and to this.observableQueriesByName.
  public addObservableQuery<T>(
    queryId: string,
    observableQuery: ObservableQuery<T>,
  ) {
    this.setQuery(queryId, () => ({ observableQuery }));
  }

  public removeObservableQuery(queryId: string) {
    const { cancel } = this.getQuery(queryId);
    this.setQuery(queryId, () => ({ observableQuery: null }));
    if (cancel) cancel();
  }

  public clearStore(): Promise<void> {
    // Before we have sent the reset action to the store,
    // we can no longer rely on the results returned by in-flight
    // requests since these may depend on values that previously existed
    // in the data portion of the store. So, we cancel the promises and observers
    // that we have issued so far and not yet resolved (in the case of
    // queries).
    this.fetchQueryRejectFns.forEach(reject => {
      reject(new InvariantError(
        'Store reset while query was in flight (not completed in link chain)',
      ));
    });

    const resetIds: string[] = [];
    this.queries.forEach(({ observableQuery }, queryId) => {
      if (observableQuery) resetIds.push(queryId);
    });

    this.queryStore.reset(resetIds);
    this.mutationStore.reset();

    // begin removing data from the store
    return this.dataStore.reset();
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
    includeStandby: boolean = false,
  ): Promise<ApolloQueryResult<any>[]> {
    const observableQueryPromises: Promise<ApolloQueryResult<any>>[] = [];

    this.queries.forEach(({ observableQuery }, queryId) => {
      if (observableQuery) {
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
      }
    });

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

  public startGraphQLSubscription<T = any>({
    query,
    fetchPolicy,
    variables,
  }: SubscriptionOptions): Observable<FetchResult<T>> {
    query = this.transform(query).document;
    variables = this.getVariables(query, variables);

    const makeObservable = (variables: OperationVariables) =>
      this.getObservableFromLink<T>(
        query,
        {},
        variables,
        false,
      ).map(result => {
        if (!fetchPolicy || fetchPolicy !== 'no-cache') {
          this.dataStore.markSubscriptionResult(
            result,
            query,
            variables,
          );
          this.broadcastQueries();
        }

        if (graphQLResultHasError(result)) {
          throw new ApolloError({
            graphQLErrors: result.errors,
          });
        }

        return result;
      });

    if (this.transform(query).hasClientExports) {
      const observablePromise = this.localState.addExportedVariables(
        query,
        variables,
      ).then(makeObservable);

      return new Observable<FetchResult<T>>(observer => {
        let sub: Subscription | null = null;
        observablePromise.then(
          observable => sub = observable.subscribe(observer),
          observer.error,
        );
        return () => sub && sub.unsubscribe();
      });
    }

    return makeObservable(variables);
  }

  public stopQuery(queryId: string) {
    this.stopQueryNoBroadcast(queryId);
    this.broadcastQueries();
  }

  private stopQueryNoBroadcast(queryId: string) {
    this.stopQueryInStoreNoBroadcast(queryId);
    this.removeQuery(queryId);
  }

  public removeQuery(queryId: string) {
    // teardown all links
    // Both `QueryManager.fetchRequest` and `QueryManager.query` create separate promises
    // that each add their reject functions to fetchQueryRejectFns.
    // A query created with `QueryManager.query()` could trigger a `QueryManager.fetchRequest`.
    // The same queryId could have two rejection fns for two promises
    this.fetchQueryRejectFns.delete(`query:${queryId}`);
    this.fetchQueryRejectFns.delete(`fetchRequest:${queryId}`);
    this.getQuery(queryId).subscriptions.forEach(x => x.unsubscribe());
    this.queries.delete(queryId);
  }

  public getCurrentQueryResult<T>(
    observableQuery: ObservableQuery<T>,
    optimistic: boolean = true,
  ): {
    data: T | undefined;
    partial: boolean;
  } {
    const { variables, query, fetchPolicy } = observableQuery.options;
    const lastResult = observableQuery.getLastResult();
    const { newData } = this.getQuery(observableQuery.queryId);

    // XXX test this
    if (newData && newData.complete) {
      return { data: newData.result, partial: false };
    } else if (fetchPolicy === 'no-cache' || fetchPolicy === 'network-only') {
      return { data: undefined, partial: false };
    } else {
      try {
        // the query is brand new, so we read from the store to see if anything is there
        const data =
          this.dataStore.getCache().read<T>({
            query,
            variables,
            previousResult: lastResult ? lastResult.data : undefined,
            optimistic,
          }) || undefined;

        return { data, partial: false };
      } catch (e) {
        return { data: undefined, partial: true };
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
      invariant(
        foundObserveableQuery,
        `ObservableQuery with this id doesn't exist: ${queryIdOrObservable}`
      );
      observableQuery = foundObserveableQuery!;
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
      if (info.invalidated) {
        info.listeners.forEach(listener => {
          // it's possible for the listener to be undefined if the query is being stopped
          // See here for more detail: https://github.com/apollostack/apollo-client/issues/231
          if (listener) {
            listener(this.queryStore.get(id), info.newData);
          }
        });
      }
    });
  }

  public getLocalState(): LocalState<TStore> {
    return this.localState;
  }

  private inFlightLinkObservables = new Map<
    DocumentNode,
    Map<string, Observable<FetchResult>>
  >();

  private getObservableFromLink<T = any>(
    query: DocumentNode,
    context: any,
    variables?: OperationVariables,
    deduplication: boolean = this.queryDeduplication,
  ): Observable<FetchResult<T>> {
    let observable: Observable<FetchResult<T>>;

    const { serverQuery } = this.transform(query);
    if (serverQuery) {
      const { inFlightLinkObservables, link } = this;

      const operation = {
        query: serverQuery,
        variables,
        operationName: getOperationName(serverQuery) || void 0,
        context: this.prepareContext({
          ...context,
          forceFetch: !deduplication
        }),
      };

      context = operation.context;

      if (deduplication) {
        const byVariables = inFlightLinkObservables.get(serverQuery) || new Map();
        inFlightLinkObservables.set(serverQuery, byVariables);

        const varJson = JSON.stringify(variables);
        observable = byVariables.get(varJson);

        if (!observable) {
          byVariables.set(
            varJson,
            observable = multiplex(
              execute(link, operation) as Observable<FetchResult<T>>
            )
          );

          const cleanup = () => {
            byVariables.delete(varJson);
            if (!byVariables.size) inFlightLinkObservables.delete(serverQuery);
            cleanupSub.unsubscribe();
          };

          const cleanupSub = observable.subscribe({
            next: cleanup,
            error: cleanup,
            complete: cleanup,
          });
        }

      } else {
        observable = multiplex(execute(link, operation) as Observable<FetchResult<T>>);
      }
    } else {
      observable = Observable.of({ data: {} } as FetchResult<T>);
      context = this.prepareContext(context);
    }

    const { clientQuery } = this.transform(query);
    if (clientQuery) {
      observable = asyncMap(observable, result => {
        return this.localState.runResolvers({
          document: clientQuery,
          remoteResult: result,
          context,
          variables,
        });
      });
    }

    return observable;
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
  }): Promise<FetchResult<T>> {
    const { variables, errorPolicy = 'none', fetchPolicy } = options;
    let resultFromStore: any;
    let errorsFromStore: any;

    return new Promise<ApolloQueryResult<T>>((resolve, reject) => {
      const observable = this.getObservableFromLink(
        document,
        options.context,
        variables,
      );

      const fqrfId = `fetchRequest:${queryId}`;
      this.fetchQueryRejectFns.set(fqrfId, reject);

      const cleanup = () => {
        this.fetchQueryRejectFns.delete(fqrfId);
        this.setQuery(queryId, ({ subscriptions }) => {
          subscriptions.delete(subscription);
        });
      };

      const subscription = observable.map((result: ExecutionResult) => {
        if (requestId >= this.getQuery(queryId).lastRequestId) {
          this.markQueryResult(
            queryId,
            result,
            options,
            fetchMoreForQueryId,
          );

          this.queryStore.markQueryResult(
            queryId,
            result,
            fetchMoreForQueryId,
          );

          this.invalidate(true, queryId, fetchMoreForQueryId);

          this.broadcastQueries();
        }

        if (result.errors && errorPolicy === 'none') {
          throw new ApolloError({
            graphQLErrors: result.errors,
          });
        }

        if (errorPolicy === 'all') {
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

        return resultFromStore;

      }).subscribe({
        error: (error: ApolloError) => {
          cleanup();
          reject(error);
        },

        complete: () => {
          cleanup();
          resolve({
            data: resultFromStore,
            errors: errorsFromStore,
            loading: false,
            networkStatus: NetworkStatus.ready,
            stale: false,
          });
        },
      });

      this.setQuery(queryId, ({ subscriptions }) => {
        subscriptions.add(subscription);
      });
    });
  }

  private getQuery(queryId: string) {
    return (
      this.queries.get(queryId) || {
        listeners: new Set<QueryListener>(),
        invalidated: false,
        document: null,
        newData: null,
        lastRequestId: 1,
        observableQuery: null,
        subscriptions: new Set<Subscription>(),
      }
    );
  }

  private setQuery<T extends keyof QueryInfo>(
    queryId: string,
    updater: (prev: QueryInfo) => Pick<QueryInfo, T> | void,
  ) {
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

  private prepareContext(context = {}) {
    const newContext = this.localState.prepareContext(context);
    return {
      ...newContext,
      clientAwareness: this.clientAwareness,
    };
  }

  public checkInFlight(queryId: string) {
    const query = this.queryStore.get(queryId);

    return (
      query &&
      query.networkStatus !== NetworkStatus.ready &&
      query.networkStatus !== NetworkStatus.error
    );
  }

  // Map from client ID to { interval, options }.
  private pollingInfoByQueryId = new Map<string, {
    interval: number;
    lastPollTimeMs: number;
    options: WatchQueryOptions;
  }>();

  private nextPoll: {
    time: number;
    timeout: NodeJS.Timeout;
  } | null = null;

  public startPollingQuery(
    options: WatchQueryOptions,
    queryId: string,
    listener?: QueryListener,
  ): string {
    const { pollInterval } = options;

    invariant(
      pollInterval,
      'Attempted to start a polling query without a polling interval.',
    );

    // Do not poll in SSR mode
    if (!this.ssrMode) {
      this.pollingInfoByQueryId.set(queryId, {
        interval: pollInterval!,
        // Avoid polling until at least pollInterval milliseconds from now.
        // The -10 is a fudge factor to help with tests that rely on simulated
        // timeouts via jest.runTimersToTime.
        lastPollTimeMs: Date.now() - 10,
        options: {
          ...options,
          fetchPolicy: 'network-only',
        },
      });

      if (listener) {
        this.addQueryListener(queryId, listener);
      }

      this.schedulePoll(pollInterval!);
    }

    return queryId;
  }

  public stopPollingQuery(queryId: string) {
    // Since the master polling interval dynamically adjusts to the contents of
    // this.pollingInfoByQueryId, stopping a query from polling is as easy as
    // removing it from the map.
    this.pollingInfoByQueryId.delete(queryId);
  }

  // Calling this method ensures a poll will happen within the specified time
  // limit, canceling any pending polls that would not happen in time.
  private schedulePoll(timeLimitMs: number) {
    const now = Date.now();

    if (this.nextPoll) {
      if (timeLimitMs < this.nextPoll.time - now) {
        // The next poll will happen too far in the future, so cancel it, and
        // fall through to scheduling a new timeout.
        clearTimeout(this.nextPoll.timeout);
      } else {
        // The next poll will happen within timeLimitMs, so all is well.
        return;
      }
    }

    this.nextPoll = {
      // Estimated time when the timeout will fire.
      time: now + timeLimitMs,

      timeout: setTimeout(() => {
        this.nextPoll = null;
        let nextTimeLimitMs = Infinity;

        this.pollingInfoByQueryId.forEach((info, queryId) => {
          // Pick next timeout according to current minimum interval.
          if (info.interval < nextTimeLimitMs) {
            nextTimeLimitMs = info.interval;
          }

          if (!this.checkInFlight(queryId)) {
            // If this query was last polled more than interval milliseconds
            // ago, poll it now. Note that there may be a small delay between
            // the desired polling time and the actual polling time (equal to
            // at most the minimum polling interval across all queries), but
            // that's the tradeoff to batching polling intervals.
            if (Date.now() - info.lastPollTimeMs >= info.interval) {
              const updateLastPollTime = () => {
                info.lastPollTimeMs = Date.now();
              };
              this.fetchQuery(queryId, info.options, FetchType.poll).then(
                // Set info.lastPollTimeMs after the fetch completes, whether
                // or not it succeeded. Promise.prototype.finally would be nice
                // here, but we don't have a polyfill for that at the moment,
                // and this code has historically silenced errors, which is not
                // the behavior of .finally(updateLastPollTime).
                updateLastPollTime,
                updateLastPollTime
              );
            }
          }
        });

        // If there were no entries in this.pollingInfoByQueryId, then
        // nextTimeLimitMs will still be Infinity, so this.schedulePoll will
        // not be called, thus ending the master polling interval.
        if (isFinite(nextTimeLimitMs)) {
          this.schedulePoll(nextTimeLimitMs);
        }
      }, timeLimitMs),
    };
  }
}
