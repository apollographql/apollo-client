import { DocumentNode } from 'graphql';
import { invariant, InvariantError } from 'ts-invariant';
import { equal } from '@wry/equality';

import { ApolloLink, execute, FetchResult } from '../link/core';
import { Cache, ApolloCache } from '../cache';

import {
  getDefaultValues,
  getOperationDefinition,
  getOperationName,
  hasClientExports,
  graphQLResultHasError,
  removeConnectionDirectiveFromDocument,
  canUseWeakMap,
  ObservableSubscription,
  Observable,
  asyncMap,
  isNonEmptyArray,
  Concast,
  ConcastSourcesIterable,
} from '../utilities';
import { ApolloError, isApolloError } from '../errors';
import {
  QueryOptions,
  WatchQueryOptions,
  SubscriptionOptions,
  MutationOptions,
  WatchQueryFetchPolicy,
  ErrorPolicy,
  RefetchQueryDescription,
  InternalRefetchQueriesOptions,
} from './watchQueryOptions';
import { ObservableQuery } from './ObservableQuery';
import { NetworkStatus, isNetworkRequestInFlight } from './networkStatus';
import {
  ApolloQueryResult,
  OperationVariables,
  MutationUpdaterFunction,
  OnQueryUpdated,
} from './types';
import { LocalState } from './LocalState';

import {
  QueryInfo,
  QueryStoreValue,
  shouldWriteResult,
  CacheWriteBehavior,
} from './QueryInfo';

const { hasOwnProperty } = Object.prototype;

interface MutationStoreValue {
  mutation: DocumentNode;
  variables: Record<string, any>;
  loading: boolean;
  error: Error | null;
}

type UpdateQueries<TData> = MutationOptions<TData, any, any>["updateQueries"];

export class QueryManager<TStore> {
  public cache: ApolloCache<TStore>;
  public link: ApolloLink;
  public readonly assumeImmutableResults: boolean;
  public readonly ssrMode: boolean;

  private queryDeduplication: boolean;
  private clientAwareness: Record<string, string> = {};
  private localState: LocalState<TStore>;

  private onBroadcast?: () => void;
  public mutationStore?: {
    [mutationId: string]: MutationStoreValue;
  };

  // All the queries that the QueryManager is currently managing (not
  // including mutations and subscriptions).
  private queries = new Map<string, QueryInfo>();

  // Maps from queryId strings to Promise rejection functions for
  // currently active queries and fetches.
  private fetchCancelFns = new Map<string, (error: any) => any>();

  constructor({
    cache,
    link,
    queryDeduplication = false,
    onBroadcast,
    ssrMode = false,
    clientAwareness = {},
    localState,
    assumeImmutableResults,
  }: {
    cache: ApolloCache<TStore>;
    link: ApolloLink;
    queryDeduplication?: boolean;
    onBroadcast?: () => void;
    ssrMode?: boolean;
    clientAwareness?: Record<string, string>;
    localState?: LocalState<TStore>;
    assumeImmutableResults?: boolean;
  }) {
    this.cache = cache;
    this.link = link;
    this.queryDeduplication = queryDeduplication;
    this.clientAwareness = clientAwareness;
    this.localState = localState || new LocalState({ cache });
    this.ssrMode = ssrMode;
    this.assumeImmutableResults = !!assumeImmutableResults;
    if ((this.onBroadcast = onBroadcast)) {
      this.mutationStore = Object.create(null);
    }
  }

  /**
   * Call this method to terminate any active query processes, making it safe
   * to dispose of this QueryManager instance.
   */
  public stop() {
    this.queries.forEach((_info, queryId) => {
      this.stopQueryNoBroadcast(queryId);
    });

    this.cancelPendingFetches(
      new InvariantError('QueryManager stopped while query was in flight'),
    );
  }

  private cancelPendingFetches(error: Error) {
    this.fetchCancelFns.forEach(cancel => cancel(error));
    this.fetchCancelFns.clear();
  }

  public async mutate<
    TData,
    TVariables,
    TContext,
    TCache extends ApolloCache<any>
  >({
    mutation,
    variables,
    optimisticResponse,
    updateQueries,
    refetchQueries = [],
    awaitRefetchQueries = false,
    update: updateWithProxyFn,
    onQueryUpdated,
    errorPolicy = 'none',
    fetchPolicy,
    context,
  }: MutationOptions<TData, TVariables, TContext>): Promise<FetchResult<TData>> {
    invariant(
      mutation,
      'mutation option is required. You must specify your GraphQL document in the mutation option.',
    );

    invariant(
      !fetchPolicy || fetchPolicy === 'no-cache',
      "Mutations only support a 'no-cache' fetchPolicy. If you don't want to disable the cache, remove your fetchPolicy setting to proceed with the default mutation behavior."
    );

    const mutationId = this.generateMutationId();
    mutation = this.transform(mutation).document;

    variables = this.getVariables(mutation, variables) as TVariables;

    if (this.transform(mutation).hasClientExports) {
      variables = await this.localState.addExportedVariables(mutation, variables, context) as TVariables;
    }

    const mutationStoreValue =
      this.mutationStore &&
      (this.mutationStore[mutationId] = {
        mutation,
        variables,
        loading: true,
        error: null,
      } as MutationStoreValue);

    if (optimisticResponse) {
      this.markMutationOptimistic<
        TData,
        TVariables,
        TContext,
        TCache
      >(optimisticResponse, {
        mutationId,
        document: mutation,
        variables,
        errorPolicy,
        context,
        updateQueries,
        update: updateWithProxyFn,
      });
    }

    this.broadcastQueries();

    const self = this;

    return new Promise((resolve, reject) => {
      return asyncMap(
        self.getObservableFromLink(
          mutation,
          {
            ...context,
            optimisticResponse,
          },
          variables,
          false,
        ),

        (result: FetchResult<TData>) => {
          if (graphQLResultHasError(result) && errorPolicy === 'none') {
            throw new ApolloError({
              graphQLErrors: result.errors,
            });
          }

          if (mutationStoreValue) {
            mutationStoreValue.loading = false;
            mutationStoreValue.error = null;
          }

          const storeResult: typeof result = { ...result };

          if (typeof refetchQueries === "function") {
            refetchQueries = refetchQueries(storeResult);
          }

          if (errorPolicy === 'ignore' &&
              graphQLResultHasError(storeResult)) {
            delete storeResult.errors;
          }

          if (fetchPolicy === 'no-cache') {
            const results: any[] = [];

            this.refetchQueries({
              include: refetchQueries,
              onQueryUpdated,
            }).forEach(result => results.push(result));

            return Promise.all(
              awaitRefetchQueries ? results : [],
            ).then(() => storeResult);
          }

          const markPromise = self.markMutationResult<
            TData,
            TVariables,
            TContext,
            TCache
          >({
            mutationId,
            result,
            document: mutation,
            variables,
            errorPolicy,
            context,
            update: updateWithProxyFn,
            updateQueries,
            refetchQueries,
            removeOptimistic: optimisticResponse ? mutationId : void 0,
            onQueryUpdated,
          });

          if (awaitRefetchQueries || onQueryUpdated) {
            // Returning the result of markMutationResult here makes the
            // mutation await the Promise that markMutationResult returns,
            // since we are returning markPromise from the map function
            // we passed to asyncMap above.
            return markPromise.then(() => storeResult);
          }

          return storeResult;
        },

      ).subscribe({
        next(storeResult) {
          self.broadcastQueries();

          // At the moment, a mutation can have only one result, so we can
          // immediately resolve upon receiving the first result. In the future,
          // mutations containing @defer or @stream directives might receive
          // multiple FetchResult payloads from the ApolloLink chain, so we will
          // probably need to collect those results in this next method and call
          // resolve only later, in an observer.complete function.
          resolve(storeResult);
        },

        error(err: Error) {
          if (mutationStoreValue) {
            mutationStoreValue.loading = false;
            mutationStoreValue.error = err;
          }

          if (optimisticResponse) {
            self.cache.removeOptimistic(mutationId);
          }

          self.broadcastQueries();

          reject(
            err instanceof ApolloError ? err : new ApolloError({
              networkError: err,
            }),
          );
        },
      });
    });
  }

  public markMutationResult<
    TData,
    TVariables,
    TContext,
    TCache extends ApolloCache<any>
  >(
    mutation: {
      mutationId: string;
      result: FetchResult<TData>;
      document: DocumentNode;
      variables?: TVariables;
      errorPolicy: ErrorPolicy;
      context?: TContext;
      updateQueries: UpdateQueries<TData>;
      update?: MutationUpdaterFunction<TData, TVariables, TContext, TCache>;
      refetchQueries?: RefetchQueryDescription;
      removeOptimistic?: string;
      onQueryUpdated?: OnQueryUpdated<TData>;
    },
    cache = this.cache,
  ): Promise<void> {
    if (shouldWriteResult(mutation.result, mutation.errorPolicy)) {
      const cacheWrites: Cache.WriteOptions[] = [{
        result: mutation.result.data,
        dataId: 'ROOT_MUTATION',
        query: mutation.document,
        variables: mutation.variables,
      }];

      const { updateQueries } = mutation;
      if (updateQueries) {
        this.queries.forEach(({ observableQuery }, queryId) => {
          const queryName = observableQuery && observableQuery.queryName;
          if (!queryName || !hasOwnProperty.call(updateQueries, queryName)) {
            return;
          }
          const updater = updateQueries[queryName];
          const { document, variables } = this.queries.get(queryId)!;

          // Read the current query result from the store.
          const { result: currentQueryResult, complete } = cache.diff<TData>({
            query: document!,
            variables,
            returnPartialData: true,
            optimistic: false,
          });

          if (complete && currentQueryResult) {
            // Run our reducer using the current query result and the mutation result.
            const nextQueryResult = updater(currentQueryResult, {
              mutationResult: mutation.result,
              queryName: document && getOperationName(document) || void 0,
              queryVariables: variables!,
            });

            // Write the modified result back into the store if we got a new result.
            if (nextQueryResult) {
              cacheWrites.push({
                result: nextQueryResult,
                dataId: 'ROOT_QUERY',
                query: document!,
                variables,
              });
            }
          }
        });
      }

      const results: any[] = [];

      this.refetchQueries({
        updateCache(cache: TCache) {
          cacheWrites.forEach(write => cache.write(write));

          // If the mutation has some writes associated with it then we need to
          // apply those writes to the store by running this reducer again with
          // a write action.
          const { update } = mutation;
          if (update) {
            update(cache, mutation.result, {
              context: mutation.context,
              variables: mutation.variables,
            });
          }
        },

        include: mutation.refetchQueries,

        // Write the final mutation.result to the root layer of the cache.
        optimistic: false,

        // Remove the corresponding optimistic layer at the same time as we
        // write the final non-optimistic result.
        removeOptimistic: mutation.removeOptimistic,

        // Let the caller of client.mutate optionally determine the refetching
        // behavior for watched queries after the mutation.update function runs.
        onQueryUpdated: mutation.onQueryUpdated,

      }).forEach(result => results.push(result));

      return Promise.all(results).then(() => void 0);
    }

    return Promise.resolve();
  }

  public markMutationOptimistic<TData, TVariables, TContext, TCache extends ApolloCache<any>>(
    optimisticResponse: any,
    mutation: {
      mutationId: string;
      document: DocumentNode;
      variables?: TVariables;
      errorPolicy: ErrorPolicy;
      context?: TContext;
      updateQueries: UpdateQueries<TData>,
      update?: MutationUpdaterFunction<TData, TVariables, TContext, TCache>;
    },
  ) {
    const data = typeof optimisticResponse === "function"
      ? optimisticResponse(mutation.variables)
      : optimisticResponse;

    return this.cache.recordOptimisticTransaction(cache => {
      try {
        this.markMutationResult<TData, TVariables, TContext, TCache>({
          ...mutation,
          result: { data },
        }, cache);
      } catch (error) {
        invariant.error(error);
      }
    }, mutation.mutationId);
  }

  public fetchQuery<TData, TVars>(
    queryId: string,
    options: WatchQueryOptions<TVars, TData>,
    networkStatus?: NetworkStatus,
  ): Promise<ApolloQueryResult<TData>> {
    return this.fetchQueryObservable<TData, TVars>(
      queryId,
      options,
      networkStatus,
    ).promise;
  }

  public getQueryStore() {
    const store: Record<string, QueryStoreValue> = Object.create(null);
    this.queries.forEach((info, queryId) => {
      store[queryId] = {
        variables: info.variables,
        networkStatus: info.networkStatus,
        networkError: info.networkError,
        graphQLErrors: info.graphQLErrors,
      };
    });
    return store;
  }

  public resetErrors(queryId: string) {
    const queryInfo = this.queries.get(queryId);
    if (queryInfo) {
      queryInfo.networkError = undefined;
      queryInfo.graphQLErrors = [];
    }
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

  public transform(document: DocumentNode) {
    const { transformCache } = this;

    if (!transformCache.has(document)) {
      const transformed = this.cache.transformDocument(document);
      const forLink = removeConnectionDirectiveFromDocument(
        this.cache.transformForLink(transformed));

      const clientQuery = this.localState.clientQuery(transformed);
      const serverQuery = forLink && this.localState.serverQuery(forLink);

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

  private getVariables<TVariables>(
    document: DocumentNode,
    variables?: TVariables,
  ): OperationVariables {
    return {
      ...this.transform(document).defaultVars,
      ...variables,
    };
  }

  public watchQuery<T, TVariables = OperationVariables>(
    options: WatchQueryOptions<TVariables, T>,
  ): ObservableQuery<T, TVariables> {
    // assign variable default values if supplied
    options = {
      ...options,
      variables: this.getVariables(
        options.query,
        options.variables,
      ) as TVariables,
    };

    if (typeof options.notifyOnNetworkStatusChange === 'undefined') {
      options.notifyOnNetworkStatusChange = false;
    }

    const queryInfo = new QueryInfo(this.cache);
    const observable = new ObservableQuery<T, TVariables>({
      queryManager: this,
      queryInfo,
      options,
    });

    this.queries.set(observable.queryId, queryInfo);

    queryInfo.init({
      document: options.query,
      observableQuery: observable,
      variables: options.variables,
    });

    return observable;
  }

  public query<TData, TVars = OperationVariables>(
    options: QueryOptions<TVars, TData>,
  ): Promise<ApolloQueryResult<TData>> {
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

    const queryId = this.generateQueryId();
    return this.fetchQuery<TData, TVars>(
      queryId,
      options,
    ).finally(() => this.stopQuery(queryId));
  }

  private queryIdCounter = 1;
  public generateQueryId() {
    return String(this.queryIdCounter++);
  }

  private requestIdCounter = 1;
  public generateRequestId() {
    return this.requestIdCounter++;
  }

  private mutationIdCounter = 1;
  public generateMutationId() {
    return String(this.mutationIdCounter++);
  }

  public stopQueryInStore(queryId: string) {
    this.stopQueryInStoreNoBroadcast(queryId);
    this.broadcastQueries();
  }

  private stopQueryInStoreNoBroadcast(queryId: string) {
    const queryInfo = this.queries.get(queryId);
    if (queryInfo) queryInfo.stop();
  }

  public clearStore(): Promise<void> {
    // Before we have sent the reset action to the store, we can no longer
    // rely on the results returned by in-flight requests since these may
    // depend on values that previously existed in the data portion of the
    // store. So, we cancel the promises and observers that we have issued
    // so far and not yet resolved (in the case of queries).
    this.cancelPendingFetches(new InvariantError(
      'Store reset while query was in flight (not completed in link chain)',
    ));

    this.queries.forEach(queryInfo => {
      if (queryInfo.observableQuery) {
        // Set loading to true so listeners don't trigger unless they want
        // results with partial data.
        queryInfo.networkStatus = NetworkStatus.loading;
      } else {
        queryInfo.stop();
      }
    });

    if (this.mutationStore) {
      this.mutationStore = Object.create(null);
    }

    // begin removing data from the store
    return this.cache.reset();
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
      if (observableQuery && observableQuery.hasObservers()) {
        const fetchPolicy = observableQuery.options.fetchPolicy;

        observableQuery.resetLastResults();
        if (
          fetchPolicy !== 'cache-only' &&
          (includeStandby || fetchPolicy !== 'standby')
        ) {
          observableQueryPromises.push(observableQuery.refetch());
        }

        this.getQuery(queryId).setDiff(null);
      }
    });

    this.broadcastQueries();

    return Promise.all(observableQueryPromises);
  }

  public setObservableQuery(observableQuery: ObservableQuery<any, any>) {
    this.getQuery(observableQuery.queryId).setObservableQuery(observableQuery);
  }

  public startGraphQLSubscription<T = any>({
    query,
    fetchPolicy,
    errorPolicy,
    variables,
    context = {},
  }: SubscriptionOptions): Observable<FetchResult<T>> {
    query = this.transform(query).document;
    variables = this.getVariables(query, variables);

    const makeObservable = (variables: OperationVariables) =>
      this.getObservableFromLink<T>(
        query,
        context,
        variables,
      ).map(result => {
        if (fetchPolicy !== 'no-cache') {
          // the subscription interface should handle not sending us results we no longer subscribe to.
          // XXX I don't think we ever send in an object with errors, but we might in the future...
          if (shouldWriteResult(result, errorPolicy)) {
            this.cache.write({
              query,
              result: result.data,
              dataId: 'ROOT_SUBSCRIPTION',
              variables: variables,
            });
          }

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
        context,
      ).then(makeObservable);

      return new Observable<FetchResult<T>>(observer => {
        let sub: ObservableSubscription | null = null;
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
    // that each add their reject functions to fetchCancelFns.
    // A query created with `QueryManager.query()` could trigger a `QueryManager.fetchRequest`.
    // The same queryId could have two rejection fns for two promises
    this.fetchCancelFns.delete(queryId);
    this.getQuery(queryId).stop();
    this.queries.delete(queryId);
  }

  public broadcastQueries() {
    if (this.onBroadcast) this.onBroadcast();
    this.queries.forEach(info => info.notify());
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
    deduplication: boolean =
      // Prefer context.queryDeduplication if specified.
      context?.queryDeduplication ??
      this.queryDeduplication,
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
          const concast = new Concast([
            execute(link, operation) as Observable<FetchResult<T>>
          ]);

          byVariables.set(varJson, observable = concast);

          concast.cleanup(() => {
            if (byVariables.delete(varJson) &&
                byVariables.size < 1) {
              inFlightLinkObservables.delete(serverQuery);
            }
          });
        }

      } else {
        observable = new Concast([
          execute(link, operation) as Observable<FetchResult<T>>
        ]);
      }
    } else {
      observable = new Concast([
        Observable.of({ data: {} } as FetchResult<T>)
      ]);
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

  private getResultsFromLink<TData, TVars>(
    queryInfo: QueryInfo,
    cacheWriteBehavior: CacheWriteBehavior,
    options: Pick<WatchQueryOptions<TVars, TData>,
      | "variables"
      | "context"
      | "fetchPolicy"
      | "errorPolicy">,
  ): Observable<ApolloQueryResult<TData>> {
    const requestId = queryInfo.lastRequestId = this.generateRequestId();

    return asyncMap(
      this.getObservableFromLink(
        queryInfo.document!,
        options.context,
        options.variables,
      ),

      result => {
        const hasErrors = isNonEmptyArray(result.errors);

        // If we interrupted this request by calling getResultsFromLink again
        // with the same QueryInfo object, we ignore the old results.
        if (requestId >= queryInfo.lastRequestId) {
          if (hasErrors && options.errorPolicy === "none") {
            // Throwing here effectively calls observer.error.
            throw queryInfo.markError(new ApolloError({
              graphQLErrors: result.errors,
            }));
          }
          queryInfo.markResult(result, options, cacheWriteBehavior);
          queryInfo.markReady();
        }

        const aqr: ApolloQueryResult<TData> = {
          data: result.data,
          loading: false,
          networkStatus: queryInfo.networkStatus || NetworkStatus.ready,
        };

        if (hasErrors && options.errorPolicy !== "ignore") {
          aqr.errors = result.errors;
        }

        return aqr;
      },

      networkError => {
        const error = isApolloError(networkError)
          ? networkError
          : new ApolloError({ networkError });

        // Avoid storing errors from older interrupted queries.
        if (requestId >= queryInfo.lastRequestId) {
          queryInfo.markError(error);
        }

        throw error;
      },
    );
  }

  public fetchQueryObservable<TData, TVars>(
    queryId: string,
    options: WatchQueryOptions<TVars, TData>,
    // The initial networkStatus for this fetch, most often
    // NetworkStatus.loading, but also possibly fetchMore, poll, refetch,
    // or setVariables.
    networkStatus = NetworkStatus.loading,
  ): Concast<ApolloQueryResult<TData>> {
    const query = this.transform(options.query).document;
    const variables = this.getVariables(query, options.variables) as TVars;
    const queryInfo = this.getQuery(queryId);

    let {
      fetchPolicy = "cache-first" as WatchQueryFetchPolicy,
      errorPolicy = "none" as ErrorPolicy,
      returnPartialData = false,
      notifyOnNetworkStatusChange = false,
      context = {},
    } = options;

    const normalized = Object.assign({}, options, {
      query,
      variables,
      fetchPolicy,
      errorPolicy,
      returnPartialData,
      notifyOnNetworkStatusChange,
      context,
    });

    const fromVariables = (variables: TVars) => {
      // Since normalized is always a fresh copy of options, it's safe to
      // modify its properties here, rather than creating yet another new
      // WatchQueryOptions object.
      normalized.variables = variables;
      return this.fetchQueryByPolicy<TData, TVars>(
        queryInfo,
        normalized,
        networkStatus,
      );
    };

    // This cancel function needs to be set before the concast is created,
    // in case concast creation synchronously cancels the request.
    this.fetchCancelFns.set(queryId, reason => {
      // Delaying the cancellation using a Promise ensures that the
      // concast variable has been initialized.
      Promise.resolve().then(() => concast.cancel(reason));
    });

    // A Concast<T> can be created either from an Iterable<Observable<T>>
    // or from a PromiseLike<Iterable<Observable<T>>>, where T in this
    // case is ApolloQueryResult<TData>.
    const concast = new Concast(
      // If the query has @export(as: ...) directives, then we need to
      // process those directives asynchronously. When there are no
      // @export directives (the common case), we deliberately avoid
      // wrapping the result of this.fetchQueryByPolicy in a Promise,
      // since the timing of result delivery is (unfortunately) important
      // for backwards compatibility. TODO This code could be simpler if
      // we deprecated and removed LocalState.
      this.transform(normalized.query).hasClientExports
        ? this.localState.addExportedVariables(
          normalized.query,
          normalized.variables,
          normalized.context,
        ).then(fromVariables)
        : fromVariables(normalized.variables!)
    );

    concast.cleanup(() => {
      this.fetchCancelFns.delete(queryId);

      const { nextFetchPolicy } = options;
      if (nextFetchPolicy) {
        // The options.nextFetchPolicy transition should happen only once,
        // but it should be possible for a nextFetchPolicy function to set
        // this.nextFetchPolicy to perform an additional transition.
        options.nextFetchPolicy = void 0;

        // When someone chooses cache-and-network or network-only as their
        // initial FetchPolicy, they often do not want future cache updates to
        // trigger unconditional network requests, which is what repeatedly
        // applying the cache-and-network or network-only policies would seem
        // to imply. Instead, when the cache reports an update after the
        // initial network request, it may be desirable for subsequent network
        // requests to be triggered only if the cache result is incomplete.
        // The options.nextFetchPolicy option provides an easy way to update
        // options.fetchPolicy after the intial network request, without
        // having to call observableQuery.setOptions.
        options.fetchPolicy = typeof nextFetchPolicy === "function"
          ? nextFetchPolicy.call(options, options.fetchPolicy || "cache-first")
          : nextFetchPolicy;
      }
    });

    return concast;
  }

  public refetchQueries<TData>({
    updateCache,
    include,
    optimistic = false,
    removeOptimistic = optimistic ? makeUniqueId("refetchQueries") : void 0,
    onQueryUpdated,
  }: InternalRefetchQueriesOptions<TData, ApolloCache<TStore>>) {
    const includedQueriesById = new Map<string, {
      desc: RefetchQueryDescription[number];
      diff: Cache.DiffResult<any> | undefined;
    }>();

    const results = new Map<ObservableQuery<any>, any>();
    function maybeAddResult(oq: ObservableQuery<any>, result: any): boolean {
      // The onQueryUpdated function can return false to ignore this query and
      // skip its normal broadcast, or true to allow the usual broadcast to
      // happen (when diff.result has changed).
      if (result === false || result === true) {
        return result;
      }

      // Returning anything other than true or false from onQueryUpdated will
      // cause the result to be included in the results Map, while also
      // canceling/overriding the normal broadcast.
      results.set(oq, result);

      // Prevent the normal cache broadcast of this result.
      return false;
    }

    if (include) {
      const queryIdsByQueryName: Record<string, string> = Object.create(null);
      this.queries.forEach((queryInfo, queryId) => {
        const oq = queryInfo.observableQuery;
        const queryName = oq && oq.queryName;
        if (queryName) {
          queryIdsByQueryName[queryName] = queryId;
        }
      });

      include.forEach(queryNameOrOptions => {
        if (typeof queryNameOrOptions === "string") {
          const queryId = queryIdsByQueryName[queryNameOrOptions];
          if (queryId) {
            includedQueriesById.set(queryId, {
              desc: queryNameOrOptions,
              diff: this.getQuery(queryId).getDiff(),
            });
          } else {
            invariant.warn(`Unknown query name ${
              JSON.stringify(queryNameOrOptions)
            } passed to refetchQueries method in options.include array`);
          }
        } else {
          includedQueriesById.set(
            // We will be issuing a fresh network request for this query, so we
            // pre-allocate a new query ID here.
            this.generateQueryId(),
            { desc: queryNameOrOptions,
              diff: void 0 },
          );
        }
      });
    }

    if (updateCache) {
      this.cache.batch({
        update: updateCache,

        // Since you can perform any combination of cache reads and/or writes in
        // the cache.batch update function, its optimistic option can be either
        // a boolean or a string, representing three distinct modes of
        // operation:
        //
        // * false: read/write only the root layer
        // * true: read/write the topmost layer
        // * string: read/write a fresh optimistic layer with that ID string
        //
        // When typeof optimistic === "string", a new optimistic layer will be
        // temporarily created within cache.batch with that string as its ID. If
        // we then pass that same string as the removeOptimistic option, we can
        // make cache.batch immediately remove the optimistic layer after
        // running the updateCache function, triggering only one broadcast.
        //
        // However, the refetchQueries method accepts only true or false for its
        // optimistic option (not string). We interpret true to mean a temporary
        // optimistic layer should be created, to allow efficiently rolling back
        // the effect of the updateCache function, which involves passing a
        // string instead of true as the optimistic option to cache.batch, when
        // refetchQueries receives optimistic: true.
        //
        // In other words, we are deliberately not supporting the use case of
        // writing to an *existing* optimistic layer (using the refetchQueries
        // updateCache function), since that would potentially interfere with
        // other optimistic updates in progress. Instead, you can read/write
        // only the root layer by passing optimistic: false to refetchQueries,
        // or you can read/write a brand new optimistic layer that will be
        // automatically removed by passing optimistic: true.
        optimistic: optimistic && removeOptimistic || false,

        // The removeOptimistic option can also be provided by itself, even if
        // optimistic === false, to remove some previously-added optimistic
        // layer safely and efficiently, like we do in markMutationResult.
        //
        // If an explicit removeOptimistic string is provided with optimistic:
        // true, the removeOptimistic string will determine the ID of the
        // temporary optimistic layer, in case that ever matters.
        removeOptimistic,

        onWatchUpdated: onQueryUpdated && function (watch, diff, lastDiff) {
          const oq =
            watch.watcher instanceof QueryInfo &&
            watch.watcher.observableQuery;

          if (oq) {
            includedQueriesById.delete(oq.queryId);
            return maybeAddResult(oq, onQueryUpdated(oq, diff, lastDiff));
          }
        },
      });
    }

    if (includedQueriesById.size) {
      includedQueriesById.forEach(({ desc, diff }, queryId) => {
        const queryInfo = this.getQuery(queryId);
        let oq = queryInfo.observableQuery;
        if (oq) {
          maybeAddResult(
            oq,
            onQueryUpdated
              ? onQueryUpdated(oq, queryInfo.getDiff(), diff)
              : oq.refetch(),
          );

        } else if (typeof desc === "object") {
          const options: WatchQueryOptions = {
            query: desc.query,
            variables: desc.variables,
            fetchPolicy: "network-only",
            context: desc.context,
          };

          queryInfo.setObservableQuery(oq = new ObservableQuery({
            queryManager: this,
            queryInfo,
            options,
          }));

          const fetchPromise = this.fetchQuery(queryId, options);
          maybeAddResult(oq, fetchPromise);
          const stop = () => this.stopQuery(queryId);
          fetchPromise.then(stop, stop);
        }
      });
    }

    if (removeOptimistic) {
      // In case no updateCache callback was provided (so cache.batch was not
      // called above, and thus did not already remove the optimistic layer),
      // remove it here. Since this is a no-op when the layer has already been
      // removed, we do it even if we called cache.batch above, since it's
      // possible this.cache is an instance of some ApolloCache subclass other
      // than InMemoryCache, and does not fully support the removeOptimistic
      // option for cache.batch.
      this.cache.removeOptimistic(removeOptimistic);
    }

    return results;
  }

  private fetchQueryByPolicy<TData, TVars>(
    queryInfo: QueryInfo,
    { query,
      variables,
      fetchPolicy,
      refetchWritePolicy,
      errorPolicy,
      returnPartialData,
      context,
      notifyOnNetworkStatusChange,
    }: WatchQueryOptions<TVars, TData>,
    // The initial networkStatus for this fetch, most often
    // NetworkStatus.loading, but also possibly fetchMore, poll, refetch,
    // or setVariables.
    networkStatus: NetworkStatus,
  ): ConcastSourcesIterable<ApolloQueryResult<TData>> {
    const oldNetworkStatus = queryInfo.networkStatus;

    queryInfo.init({
      document: query,
      variables,
      networkStatus,
    });

    const readCache = () => queryInfo.getDiff(variables);

    const resultsFromCache = (
      diff: Cache.DiffResult<TData>,
      networkStatus = queryInfo.networkStatus || NetworkStatus.loading,
    ) => {
      const data = diff.result;

      if (process.env.NODE_ENV !== 'production' &&
          isNonEmptyArray(diff.missing) &&
          !equal(data, {}) &&
          !returnPartialData) {
        invariant.warn(`Missing cache result fields: ${
          diff.missing.map(m => m.path.join('.')).join(', ')
        }`, diff.missing);
      }

      const fromData = (data: TData | undefined) => Observable.of({
        data,
        loading: isNetworkRequestInFlight(networkStatus),
        networkStatus,
        ...(diff.complete ? null : { partial: true }),
      } as ApolloQueryResult<TData>);

      if (data && this.transform(query).hasForcedResolvers) {
        return this.localState.runResolvers({
          document: query,
          remoteResult: { data },
          context,
          variables,
          onlyRunForcedResolvers: true,
        }).then(resolved => fromData(resolved.data || void 0));
      }

      return fromData(data);
    };

    const cacheWriteBehavior =
      fetchPolicy === "no-cache" ? CacheWriteBehavior.FORBID :
      ( // Watched queries must opt into overwriting existing data on refetch,
        // by passing refetchWritePolicy: "overwrite" in their WatchQueryOptions.
        networkStatus === NetworkStatus.refetch &&
        refetchWritePolicy !== "merge"
      ) ? CacheWriteBehavior.OVERWRITE
        : CacheWriteBehavior.MERGE;

    const resultsFromLink = () =>
      this.getResultsFromLink<TData, TVars>(queryInfo, cacheWriteBehavior, {
        variables,
        context,
        fetchPolicy,
        errorPolicy,
      });

    const shouldNotify =
      notifyOnNetworkStatusChange &&
      typeof oldNetworkStatus === "number" &&
      oldNetworkStatus !== networkStatus &&
      isNetworkRequestInFlight(networkStatus);

    switch (fetchPolicy) {
    default: case "cache-first": {
      const diff = readCache();

      if (diff.complete) {
        return [
          resultsFromCache(diff, queryInfo.markReady()),
        ];
      }

      if (returnPartialData || shouldNotify) {
        return [
          resultsFromCache(diff),
          resultsFromLink(),
        ];
      }

      return [
        resultsFromLink(),
      ];
    }

    case "cache-and-network": {
      const diff = readCache();

      if (diff.complete || returnPartialData || shouldNotify) {
        return [
          resultsFromCache(diff),
          resultsFromLink(),
        ];
      }

      return [
        resultsFromLink(),
      ];
    }

    case "cache-only":
      return [
        resultsFromCache(readCache(), queryInfo.markReady()),
      ];

    case "network-only":
      if (shouldNotify) {
        return [
          resultsFromCache(readCache()),
          resultsFromLink(),
        ];
      }

      return [resultsFromLink()];

    case "no-cache":
      if (shouldNotify) {
        return [
          // Note that queryInfo.getDiff() for no-cache queries does not call
          // cache.diff, but instead returns a { complete: false } stub result
          // when there is no queryInfo.diff already defined.
          resultsFromCache(queryInfo.getDiff()),
          resultsFromLink(),
        ];
      }

      return [resultsFromLink()];

    case "standby":
      return [];
    }
  }

  private getQuery(queryId: string): QueryInfo {
    if (queryId && !this.queries.has(queryId)) {
      this.queries.set(queryId, new QueryInfo(this.cache));
    }
    return this.queries.get(queryId)!;
  }

  private prepareContext(context = {}) {
    const newContext = this.localState.prepareContext(context);
    return {
      ...newContext,
      clientAwareness: this.clientAwareness,
    };
  }
}

const prefixCounts: Record<string, number> = Object.create(null);
function makeUniqueId(prefix: string) {
  const count = prefixCounts[prefix] || 1;
  prefixCounts[prefix] = count + 1;
  return `${prefix}:${count}:${Math.random().toString(36).slice(2)}`;
}
