import { useContext, useEffect, useReducer, useRef } from 'react';
import { invariant } from 'ts-invariant';
import { equal } from '@wry/equality';
import { OperationVariables } from '../../core';
import { ApolloContextValue, getApolloContext } from '../context';
import { ApolloError } from '../../errors';
import {
  ApolloClient,
  NetworkStatus,
  FetchMoreQueryOptions,
  SubscribeToMoreOptions,
  ObservableQuery,
  FetchMoreOptions,
  UpdateQueryOptions,
  DocumentNode,
  TypedDocumentNode,
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


// The interface expected by RenderPromises
interface QueryData<TData, TVariables> {
  getOptions(): QueryDataOptions<TData, TVariables>;
  fetchData(): Promise<void> | boolean;
}

class QueryData<TData, TVariables> {
  public isMounted: boolean;
  public context: ApolloContextValue;
  private options = {} as QueryDataOptions<TData, TVariables>;
  private onNewData: () => void;
  private currentObservable?: ObservableQuery<TData, TVariables>;
  private currentSubscription?: ObservableSubscription;
  private previous: {
    client?: ApolloClient<object>;
    query?: DocumentNode | TypedDocumentNode<TData, TVariables>;
    options?: QueryDataOptions<TData, TVariables>;
    // TODO(brian): WHAT IS THE DIFFERENCE???????????
    observableQueryOptions?: QueryDataOptions<TData, TVariables>;
    // TODO(brian): previous.result should be assigned once in an update, we
    // shouldn’t have loading/error defined separately
    result?: QueryResult<TData, TVariables>;
    loading?: boolean;
    error?: ApolloError;
  } = Object.create(null);

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
  }

  // Called by RenderPromises
  public getOptions(): QueryDataOptions<TData, TVariables> {
    return this.options;
  }

  public setOptions(newOptions: QueryDataOptions<TData, TVariables>) {
    if (!equal(this.options, newOptions)) {
      this.previous.options = this.options;
    }

    this.options = newOptions;
  }

  // Called by RenderPromises
  public fetchData(): Promise<void> | boolean {
    const options = this.options;
    if (options.skip || options.ssr === false) return false;
    return new Promise(resolve => this.startQuerySubscription(resolve));
  }

  private ssrInitiated() {
    return this.context && this.context.renderPromises;
  }

  private getExecuteSsrResult(
    client: ApolloClient<object>
  ): QueryResult<TData, TVariables> | undefined {
    const { ssr, skip } = this.options;
    const ssrDisabled = ssr === false;
    const fetchDisabled = client.disableNetworkFetches;
    const ssrLoading = {
      loading: true,
      networkStatus: NetworkStatus.loading,
      called: true,
      data: undefined,
      stale: false,
      client,
      ...this.observableQueryFields(),
    } as QueryResult<TData, TVariables>;

    // If SSR has been explicitly disabled, and this function has been called
    // on the server side, return the default loading state.
    if (ssrDisabled && (this.ssrInitiated() || fetchDisabled)) {
      this.previous.result = ssrLoading;
      return ssrLoading;
    }

    if (this.ssrInitiated()) {
      const result = this.getExecuteResult(client) || ssrLoading;
      if (result.loading && !skip) {
        this.context.renderPromises!.addQueryPromise(this, () => null);
      }
      return result;
    }
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

  public execute(client: ApolloClient<object>): QueryResult<TData, TVariables> {
    const { skip, query } = this.options;
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

    verifyDocumentType(this.options.query, DocumentType.Query);
    const observableQueryOptions = {
      ...this.options,
      fetchPolicy:
        this.context &&
        this.context.renderPromises &&
          (
            this.options.fetchPolicy === 'network-only' ||
            this.options.fetchPolicy === 'cache-and-network'
          )
        ? 'cache-first'
        : this.options.fetchPolicy,
      displayName: this.options.displayName || 'Query',
      children: void 0,
    };

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
    } else {
      if (this.options.skip) {
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
    }

    // TODO(brian): No.
    return this.getExecuteSsrResult(client) || this.getExecuteResult(client);
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

  private getExecuteResult(
    client: ApolloClient<object>,
  ): QueryResult<TData, TVariables> {
    const result = this.observableQueryFields() as QueryResult<TData, TVariables>;
    const options = this.options;

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
    if (options.skip) {

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
        const { partialRefetch } = options;
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
    this.setOptions(options);
    const previousResult = this.previous.result;

    // TODO(brian): WHAT THE FUCK
    this.previous.loading =
      previousResult && previousResult.loading || false;

    // Ensure the returned result contains previousData as a separate
    // property, to give developers the flexibility of leveraging outdated
    // data while new data is loading from the network. Falling back to
    // previousResult.previousData when previousResult.data is falsy here
    // allows result.previousData to persist across multiple results.
    result.previousData = previousResult &&
      (previousResult.data || previousResult.previousData);

    // TODO(brian): WHY IS THIS ASSIGNED HERE
    this.previous.result = result;

    // Any query errors that exist are now available in `result`, so we'll
    // remove the original errors from the `ObservableQuery` query store to
    // make sure they aren't re-displayed on subsequent (potentially error
    // free) requests/responses.
    this.currentObservable && this.currentObservable.resetQueryStoreErrors();

    return result;
  }

  // observableQueryFields
  private obsRefetch = (variables?: Partial<TVariables>) =>
    this.currentObservable?.refetch(variables);

  private obsFetchMore = (
    fetchMoreOptions: FetchMoreQueryOptions<TVariables, TData> &
      FetchMoreOptions<TData, TVariables>
  ) => this.currentObservable!.fetchMore(fetchMoreOptions);

  private obsUpdateQuery = <TVars = TVariables>(
    mapFn: (
      previousQueryResult: TData,
      options: UpdateQueryOptions<TVars>
    ) => TData
  ) => this.currentObservable!.updateQuery(mapFn);

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
  ) => this.currentObservable!.subscribeToMore(options);

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
  const updatedOptions: QueryDataOptions<TData, TVariables> = {
    ...options,
    query,
  };

  const queryDataRef = useRef<QueryData<TData, TVariables>>();
  const queryData = queryDataRef.current || (
    queryDataRef.current = new QueryData<TData, TVariables>({
      options: updatedOptions,
      context,
      onNewData() {
        if (queryDataRef.current && queryDataRef.current.isMounted) {
          forceUpdate();
        }
      }
    })
  );

  queryData.setOptions(updatedOptions);
  queryData.context = context;
  const result = useDeepMemo(
    () => queryData.execute(client),
    [updatedOptions, context, tick],
  );

  if (__DEV__) {
    // ensure we run an update after refreshing so that we reinitialize
    useAfterFastRefresh(forceUpdate);
  }

  useEffect(() => () => {
    queryData.cleanup();
    // this effect can run multiple times during a fast-refresh so make sure
    // we clean up the ref
    queryDataRef.current = void 0;
  }, []);

  useEffect(() => queryData.afterExecute(), [
    result.loading,
    result.networkStatus,
    result.error,
    result.data,
  ]);

  return result;
}
