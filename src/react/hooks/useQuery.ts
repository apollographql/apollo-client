import {
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import { invariant } from 'ts-invariant';
import { equal } from '@wry/equality';
import { OperationVariables } from '../../core';
import { ApolloContextValue, getApolloContext } from '../context';
import { ApolloError } from '../../errors';
import {
  ApolloClient,
  ApolloQueryResult,
  NetworkStatus,
  FetchMoreQueryOptions,
  SubscribeToMoreOptions,
  ObservableQuery,
  FetchMoreOptions,
  UpdateQueryOptions,
  DocumentNode,
  TypedDocumentNode,
  WatchQueryOptions,
} from '../../core';
import {
  QueryDataOptions,
  QueryHookOptions,
  QueryResult,
  ObservableQueryFields,
} from '../types/types';

import {
  ObservableSubscription
} from '../../utilities';
import { DocumentType, parser, operationName } from '../parser';

import { useDeepMemo } from './utils/useDeepMemo';
import { useAfterFastRefresh } from './utils/useAfterFastRefresh';

function verifyDocumentType(document: DocumentNode, type: DocumentType) {
  const operation = parser(document);
  const requiredOperationName = operationName(type);
  const usedOperationName = operationName(operation.type);
  invariant(
    operation.type === type,
    `Running a ${requiredOperationName} requires a graphql ` +
      `${requiredOperationName}, but a ${usedOperationName} was used instead.`
  );
}

function prepareOptions<TData, TVariables>(
  options: QueryDataOptions<TData, TVariables>,
  context: ApolloContextValue,
): WatchQueryOptions<TVariables, TData> {
  return {
    ...options,
    fetchPolicy:
      context &&
      context.renderPromises &&
      (
        options.fetchPolicy === 'network-only' ||
        options.fetchPolicy === 'cache-and-network'
      )
      ? 'cache-first'
      : options.fetchPolicy,
  };
}


// The interface expected by RenderPromises
interface QueryData<TData, TVariables> {
  getOptions(): QueryDataOptions<TData, TVariables>;
  fetchData(): Promise<void> | boolean;
}

class QueryData<TData, TVariables> {
  public isMounted: boolean;
  public context: ApolloContextValue;
  private options: QueryDataOptions<TData, TVariables>;
  private onNewData: () => void;
  private currentObservable?: ObservableQuery<TData, TVariables>;
  private currentSubscription?: ObservableSubscription;
  private previous: {
    client?: ApolloClient<object>;
    options?: QueryDataOptions<TData, TVariables>;
    // TODO(brian): deduplicate with
    query?: DocumentNode | TypedDocumentNode<TData, TVariables>;
    observableQueryOptions?: WatchQueryOptions<TVariables, TData>;
    // TODO(brian): previous.result should be assigned once in an update, we
    // shouldn’t have loading/error defined separately
    result?: QueryResult<TData, TVariables>;
    loading?: boolean;
    error?: ApolloError;
  };

  constructor({
    options,
    context,
    onNewData
  }: {
    options: QueryDataOptions<TData, TVariables>;
    context: ApolloContextValue;
    onNewData: () => void;
  }) {
    this.options = options || ({} as QueryDataOptions<TData, TVariables>);
    this.context = context || {};
    this.onNewData = onNewData;
    this.isMounted = false;
    this.previous = {};
  }

  public getOptions(): QueryDataOptions<TData, TVariables> {
    return this.options;
  }

  public fetchData(): Promise<void> | boolean {
    const options = this.options;
    if (options.skip || options.ssr === false) return false;
    return new Promise(resolve => this.startQuerySubscription(resolve));
  }

  public cleanup() {
    if (this.currentSubscription) {
      this.currentSubscription.unsubscribe();
      delete this.currentSubscription;
    }

    if (this.currentObservable) {
      // TODO(brian): HISSSSSSSSSSSSSSSSSSSSSSS BAD HISSSSSSSSSSSSSSSS
      this.currentObservable["tearDownQuery"]();
      delete this.currentObservable;
    }
  }

  public execute(
    client: ApolloClient<object>,
    options: QueryDataOptions<TData, TVariables>
  ): QueryResult<TData, TVariables> {
    // TODO: STOP ASSIGNING OPTIONS HERE
    if (!equal(this.options, options)) {
      this.previous.options = this.options;
      this.options = options;
    }

    const { skip, query, ssr } = this.options;
    verifyDocumentType(query, DocumentType.Query);
    // if skip, query, or client are different we restart?
    if (this.previous.client !== client) {
      if (this.previous.client) {
        this.cleanup();
        delete this.previous.result;
      }

      this.previous.client = client;
    }

    if (skip || query !== this.previous.query) {
      this.cleanup();
      this.previous = Object.create(null);
      this.previous.query = query;
    }

    const observableQueryOptions = prepareOptions(this.options, this.context);
    // If we skipped initially, we may not have yet created the observable
    if (!this.currentObservable) {
      // See if there is an existing observable that was used to fetch the same
      // data and if so, use it instead since it will contain the proper
      // queryId to fetch the result set. This is used during SSR.
      if (this.context && this.context.renderPromises) {
        this.currentObservable = this.context.renderPromises.getSSRObservable(
          this.options,
        );
      }

      if (!this.currentObservable) {
        this.previous.observableQueryOptions = observableQueryOptions;
        this.currentObservable = client.watchQuery(observableQueryOptions);

        if (this.context && this.context.renderPromises) {
          this.context.renderPromises.registerSSRObservable(
            this.currentObservable,
            observableQueryOptions
          );
        }
      }
    } else if (skip) {
      this.previous.observableQueryOptions = observableQueryOptions;
    } else if (
      !equal(observableQueryOptions, this.previous.observableQueryOptions)
    ) {
      this.previous.observableQueryOptions = observableQueryOptions;
      this.currentObservable
        .setOptions(observableQueryOptions)
        // The error will be passed to the child container, so we don't
        // need to log it here. We could conceivably log something if
        // an option was set. OTOH we don't log errors w/ the original
        // query. See https://github.com/apollostack/react-apollo/issues/404
        .catch(() => {});
    }

    const ssrDisabled = ssr === false;
    const ssrLoading = {
      ...this.observableQueryFields(),
      loading: true,
      networkStatus: NetworkStatus.loading,
      called: true,
      data: undefined,
      stale: false,
      client,
    } as QueryResult<TData, TVariables>;

    // If SSR has been explicitly disabled, and this function has been called
    // on the server side, return the default loading state.
    if (
      ssrDisabled &&
      (this.context.renderPromises || client.disableNetworkFetches)
    ) {
      // TODO(brian): Don’t assign this here.
      this.previous.result = ssrLoading;
      return ssrLoading;
    }

    const result = this.observableQueryFields() as QueryResult<TData, TVariables>;
    // When skipping a query (ie. we're not querying for data but still want
    // to render children), make sure the `data` is cleared out and
    // `loading` is set to `false` (since we aren't loading anything).
    //
    // NOTE: We no longer think this is the correct behavior. Skipping should
    // not automatically set `data` to `undefined`, but instead leave the
    // previous data in place. In other words, skipping should not mandate
    // that previously received data is all of a sudden removed. Unfortunately,
    // changing this is breaking, so we'll have to wait until Apollo Client
    // 4.0 to address this.
    if (skip) {
      Object.assign(result, {
        data: undefined,
        error: undefined,
        loading: false,
        networkStatus: NetworkStatus.ready,
        called: true,
      });
    } else if (this.currentObservable) {
      // Fetch the current result (if any) from the store.
      const currentResult = this.currentObservable.getCurrentResult();
      const { data, loading, partial, networkStatus, errors } = currentResult;
      let { error } = currentResult;

      // Until a set naming convention for networkError and graphQLErrors is
      // decided upon, we map errors (graphQLErrors) to the error options.
      if (errors && errors.length > 0) {
        error = new ApolloError({ graphQLErrors: errors });
      }

      Object.assign(result, {
        data,
        loading,
        networkStatus,
        error,
        called: true
      });

      if (loading) {
        // Fall through without modifying result...
      } else if (error) {
        Object.assign(result, {
          data: (this.currentObservable.getLastResult() || ({} as any))
            .data
        });
      } else {
        const { fetchPolicy } = this.currentObservable.options;
        const { partialRefetch } = this.options;
        if (
          partialRefetch &&
          partial &&
          (!data || Object.keys(data).length === 0) &&
          fetchPolicy !== 'cache-only'
        ) {
          // When a `Query` component is mounted, and a mutation is executed
          // that returns the same ID as the mounted `Query`, but has less
          // fields in its result, Apollo Client's `QueryManager` returns the
          // data as `undefined` since a hit can't be found in the cache.
          // This can lead to application errors when the UI elements rendered by
          // the original `Query` component are expecting certain data values to
          // exist, and they're all of a sudden stripped away. To help avoid
          // this we'll attempt to refetch the `Query` data.
          Object.assign(result, {
            loading: true,
            networkStatus: NetworkStatus.loading
          });
          result.refetch();
          return result;
        }
      }
    }

    result.client = client;
    const previousResult = this.previous.result;

    // Ensure the returned result contains previousData as a separate
    // property, to give developers the flexibility of leveraging outdated
    // data while new data is loading from the network. Falling back to
    // previousResult.previousData when previousResult.data is falsy here
    // allows result.previousData to persist across multiple results.
    result.previousData = previousResult &&
      (previousResult.data || previousResult.previousData);

    // Any query errors that exist are now available in `result`, so we'll
    // remove the original errors from the `ObservableQuery` query store to
    // make sure they aren't re-displayed on subsequent (potentially error
    // free) requests/responses.
    this.currentObservable && this.currentObservable.resetQueryStoreErrors();

    if (this.context.renderPromises && result.loading && !skip) {
      this.context.renderPromises!.addQueryPromise(this, () => null);
    }

    // TODO(brian): Stop assigning this here!!!!
    this.previous.loading =
      previousResult && previousResult.loading || false;
    this.previous.result = result;

    return result;
  }

  public afterExecute() {
    this.isMounted = true;
    const options = this.options;
    const ssrDisabled = options.ssr === false;
    // TODO(brian): WHY WOULD this.currentObservable BE UNDEFINED HERE????????
    if (
      this.currentObservable &&
      !ssrDisabled &&
      !(this.context && this.context.renderPromises)
    ) {
      this.startQuerySubscription();
    }

    if (this.currentObservable && this.previous.result) {
      const { data, loading, error } = this.previous.result;
      if (!loading) {
        const {
          query,
          variables,
          onCompleted,
          onError,
          skip
        } = this.options;

        // No changes, so we won't call onError/onCompleted.
        if (
          this.previous.options &&
          !this.previous.loading &&
          equal(this.previous.options.query, query) &&
          equal(this.previous.options.variables, variables)
        ) {
          return;
        }

        // TODO(brian): Why would we not fire onCompleted on skip?
        // Why would we not apply the same logic for onError?
        if (onCompleted && !error && !skip) {
          onCompleted(data as TData);
        } else if (onError && error) {
          onError(error);
        }
      }
    }

    return () => {
      this.isMounted = false;
    };
  }

  // Setup a subscription to watch for Apollo Client `ObservableQuery` changes.
  // When new data is received, and it doesn't match the data that was used
  // during the last `QueryData.execute` call (and ultimately the last query
  // component render), trigger the `onNewData` callback. If not specified,
  // `onNewData` will fallback to the default `QueryData.onNewData` function
  // (which usually leads to a query component re-render).
  private startQuerySubscription(onNewData: () => void = this.onNewData) {
    if (this.currentSubscription || this.options.skip) return;

    this.currentSubscription = this.currentObservable!.subscribe({
      next: ({ loading, networkStatus, data }) => {
        const previousResult = this.previous.result;

        // Make sure we're not attempting to re-render similar results
        if (
          previousResult &&
          previousResult.loading === loading &&
          previousResult.networkStatus === networkStatus &&
          equal(previousResult.data, data)
        ) {
          return;
        }

        onNewData();
      },
      error: error => {
        if (this.currentSubscription) {
          this.currentSubscription.unsubscribe();
          delete this.currentSubscription;
        }

        // Unfortunately, if `lastError` is set in the current
        // `observableQuery` when the subscription is re-created,
        // the subscription will immediately receive the error, which will
        // cause it to terminate again. To avoid this, we first clear
        // the last error/result from the `observableQuery` before re-starting
        // the subscription, and restore it afterwards (so the subscription
        // has a chance to stay open).
        const { currentObservable } = this;
        if (currentObservable) {
          // TODO(brian): WHAT THE FUCK
          const lastError = currentObservable.getLastError();
          const lastResult = currentObservable.getLastResult();
          currentObservable.resetLastResults();
          this.startQuerySubscription();
          Object.assign(currentObservable, {
            lastError,
            lastResult
          });
        }

        if (!error.hasOwnProperty('graphQLErrors')) throw error;

        const previousResult = this.previous.result;
        if (
          (previousResult && previousResult.loading) ||
          !equal(error, this.previous.error)
        ) {
          this.previous.error = error;
          onNewData();
        }
      }
    });
  }

  // observableQueryFields

  private obsRefetch = (variables?: Partial<TVariables>) =>
    this.currentObservable?.refetch(variables);

  private obsFetchMore = (
    fetchMoreOptions: FetchMoreQueryOptions<TVariables, TData> &
      FetchMoreOptions<TData, TVariables>
  ) => this.currentObservable?.fetchMore(fetchMoreOptions);

  private obsUpdateQuery = <TVars = TVariables>(
    mapFn: (
      previousQueryResult: TData,
      options: UpdateQueryOptions<TVars>
    ) => TData
  ) => this.currentObservable?.updateQuery(mapFn);

  private obsStartPolling = (pollInterval: number) => {
    this.currentObservable?.startPolling(pollInterval);
  };

  private obsStopPolling = () => {
    this.currentObservable?.stopPolling();
  };

  private obsSubscribeToMore = <
    TSubscriptionData = TData,
    TSubscriptionVariables = TVariables
  >(
    options: SubscribeToMoreOptions<
      TData,
      TSubscriptionVariables,
      TSubscriptionData
    >
  ) => this.currentObservable?.subscribeToMore(options);

  private observableQueryFields() {
    return {
      variables: this.currentObservable?.variables,
      refetch: this.obsRefetch,
      fetchMore: this.obsFetchMore,
      updateQuery: this.obsUpdateQuery,
      startPolling: this.obsStartPolling,
      stopPolling: this.obsStopPolling,
      subscribeToMore: this.obsSubscribeToMore
    } as ObservableQueryFields<TData, TVariables>;
  }
}

export function useQuery<TData = any, TVariables = OperationVariables>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options?: QueryHookOptions<TData, TVariables>,
) {
  const context = useContext(getApolloContext());
  const client = options?.client || context.client;
  invariant(
    !!client,
    'Could not find "client" in the context or passed in as an option. ' +
      'Wrap the root component in an <ApolloProvider>, or pass an ' +
      'ApolloClient instance in via options.'
  );

  const [tick, forceUpdate] = useReducer(x => x + 1, 0);
  const optionsWithQuery: QueryDataOptions<TData, TVariables> = {
    ...options,
    query,
  };

  const queryDataRef = useRef<QueryData<TData, TVariables>>();
  const queryData = queryDataRef.current || (
    queryDataRef.current = new QueryData<TData, TVariables>({
      options: optionsWithQuery,
      context,
      onNewData() {
        if (queryDataRef.current && queryDataRef.current.isMounted) {
          forceUpdate();
        }
      }
    })
  );

  queryData.context = context;
  const result = useDeepMemo(
    () => queryData.execute(client, optionsWithQuery),
    [optionsWithQuery, context, tick],
  );

  if (__DEV__) {
    // ensure we run an update after refreshing so that we reinitialize
    useAfterFastRefresh(forceUpdate);
  }

  useEffect(() => queryData.afterExecute(), [
    result.loading,
    result.networkStatus,
    result.error,
    result.data,
  ]);

  useEffect(() => () => {
    queryData.cleanup();
    // this effect can run multiple times during a fast-refresh so make sure
    // we clean up the ref
    queryDataRef.current = void 0;
  }, []);

  return result;
}

export function useQuery1<
  TData = any,
  TVariables = OperationVariables,
>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  hookOptions?: QueryHookOptions<TData, TVariables>,
): QueryResult<TData> {
  const context = useContext(getApolloContext());
  const client = hookOptions?.client || context.client;
  invariant(
    !!client,
    'Could not find "client" in the context or passed in as an option. ' +
    'Wrap the root component in an <ApolloProvider>, or pass an ApolloClient' +
    'ApolloClient instance in via options.',
  );
  verifyDocumentType(query, DocumentType.Query);
  const options = useMemo(() => ({...hookOptions, query}), [hookOptions]);
  const {onCompleted, onError} = options;
  const [obsQuery, setObsQuery] = useState(() => client.watchQuery(options));
  const [result, setResult] = useState(() => obsQuery.getCurrentResult());
  const prevRef = useRef<{
    client: ApolloClient<unknown>,
    query: DocumentNode | TypedDocumentNode<TData, TVariables>,
    options: QueryDataOptions<TData, TVariables>,
    result: ApolloQueryResult<TData>,
    data: TData | undefined,
  }>({
    client,
    query,
    options,
    result,
    data: undefined,
  });

  useEffect(() => {
    if (
      prevRef.current.client !== client ||
      !equal(prevRef.current.query, query)
    ) {
      setObsQuery(client.watchQuery(options));
    }

    if (!equal(prevRef.current.options, options)) {
      obsQuery.setOptions({...options, query}).catch(() => {});
      const result = obsQuery.getCurrentResult();
      const previousResult = prevRef.current.result;
      if (previousResult.data) {
        prevRef.current.data = previousResult.data;
      }

      prevRef.current.result = result;
      setResult(result);
    }

    Object.assign(prevRef.current, { client, query, options });
  }, [obsQuery, client, query, options]);

  useEffect(() => {
    const sub = obsQuery.subscribe(
      () => {
        const previousResult = prevRef.current.result;
        // We use `getCurrentResult()` instead of the callback argument because
        // the values differ slightly. Specifically, loading results will often
        // have an empty object (`{}`) for data instead of `undefined`.
        const nextResult = obsQuery.getCurrentResult();
        // Make sure we're not attempting to re-render similar results
        if (
          previousResult &&
          previousResult.loading === nextResult.loading &&
          previousResult.networkStatus === nextResult.networkStatus &&
          equal(previousResult.data, nextResult.data)
        ) {
          return;
        }

        if (previousResult.data) {
          prevRef.current.data = previousResult.data;
        }

        prevRef.current.result = nextResult;
        setResult(nextResult);
      },
      (error) => {
        throw error;
        //subscriptionRef.current = undefined;
        // Unfortunately, if `lastError` is set in the current
        // `observableQuery` when the subscription is re-created, the
        // subscription will immediately receive the error, which will cause
        // it to terminate again. To avoid this, we first clear the last
        // error/result from the `observableQuery` before re-starting the
        // subscription, and restore it afterwards (so the subscription has a
        // chance to stay open).
        //const lastError = obsQuery.getLastError();
        //const lastResult = obsQuery.getLastResult();
        //obsQuery.resetLastResults();
        //this.startQuerySubscription();
        //Object.assign(obsQuery, { lastError, lastResult });
      },
    );

    return () => sub.unsubscribe();
  }, [obsQuery]);

  const obsQueryFields = useMemo(() => ({
    refetch: obsQuery.refetch.bind(obsQuery),
    fetchMore: obsQuery.fetchMore.bind(obsQuery),
    updateQuery: obsQuery.updateQuery.bind(obsQuery),
    startPolling: obsQuery.startPolling.bind(obsQuery),
    stopPolling: obsQuery.stopPolling.bind(obsQuery),
    subscribeToMore: obsQuery.subscribeToMore.bind(obsQuery),
  }), [obsQuery]);

  useEffect(() => {
    if (!result.loading) {
      if (result.error) {
        onError?.(result.error);
      } else {
        onCompleted?.(result.data);
      }
    }
    // TODO: Do we need to add onCompleted and onError to the dependency array
  }, [result, onCompleted, onError]);

  return {
    ...obsQueryFields,
    variables: obsQuery.variables,
    client,
    called: true,
    previousData: prevRef.current.data,
    ...result,
  };
}
