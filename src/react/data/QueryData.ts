import { equal } from '@wry/equality';

import { ApolloError } from '../../errors/ApolloError';
import { NetworkStatus } from '../../core/networkStatus';
import {
  FetchMoreQueryOptions,
  SubscribeToMoreOptions
} from '../../core/watchQueryOptions';
import {
  ObservableQuery,
  FetchMoreOptions,
  UpdateQueryOptions
} from '../../core/ObservableQuery';

import {
  ObservableSubscription
} from '../../utilities/observables/Observable';

import { DocumentType } from '../parser/parser';
import {
  QueryResult,
  QueryPreviousData,
  QueryDataOptions,
  QueryTuple,
  QueryLazyOptions,
  ObservableQueryFields,
  LazyQueryResult
} from '../types/types';
import { OperationData } from './OperationData';

export class QueryData<TData, TVariables> extends OperationData {
  private previousData: QueryPreviousData<TData, TVariables> = {};
  private currentObservable?: ObservableQuery<TData, TVariables>;
  private currentSubscription?: ObservableSubscription;
  private forceUpdate: any;
  private runLazy: boolean = false;
  private lazyOptions?: QueryLazyOptions<TVariables>;

  constructor({
    options,
    context,
    forceUpdate
  }: {
    options: QueryDataOptions<TData, TVariables>;
    context: any;
    forceUpdate: any;
  }) {
    super(options, context);
    this.forceUpdate = forceUpdate;
  }

  public execute(): QueryResult<TData, TVariables> {
    this.refreshClient();

    const { skip, query } = this.getOptions();
    if (skip || query !== this.previousData.query) {
      this.removeQuerySubscription();
      this.previousData.query = query;
    }

    this.updateObservableQuery();

    if (this.isMounted) this.startQuerySubscription();

    return this.getExecuteSsrResult() || this.getExecuteResult();
  }

  public executeLazy(): QueryTuple<TData, TVariables> {
    return !this.runLazy
      ? [
          this.runLazyQuery,
          {
            loading: false,
            networkStatus: NetworkStatus.ready,
            called: false,
            data: undefined
          }
        ]
      : [this.runLazyQuery, this.execute()];
  }

  // For server-side rendering
  public fetchData(): Promise<void> | boolean {
    const options = this.getOptions();
    if (options.skip || options.ssr === false) return false;
    return new Promise(resolve => this.startQuerySubscription(resolve));
  }

  public afterExecute({
    queryResult,
    lazy = false,
  }: {
    queryResult: QueryResult<TData, TVariables> | LazyQueryResult<TData, TVariables>;
    lazy?: boolean;
  }) {
    this.isMounted = true;

    if (!lazy || this.runLazy) {
      this.handleErrorOrCompleted(queryResult as QueryResult<TData, TVariables>);

      // When the component is done rendering stored query errors, we'll
      // remove those errors from the `ObservableQuery` query store, so they
      // aren't re-displayed on subsequent (potentially error free)
      // requests/responses.
      setTimeout(() => {
        this.currentObservable?.resetQueryStoreErrors();
      });
    }

    this.previousOptions = this.getOptions();
    return this.unmount.bind(this);
  }

  public cleanup() {
    this.removeQuerySubscription();
    delete this.currentObservable;
    delete this.previousData.result;
  }

  public getOptions() {
    const options = super.getOptions();

    if (this.lazyOptions) {
      options.variables = {
        ...options.variables,
        ...this.lazyOptions.variables
      };
      options.context = {
        ...options.context,
        ...this.lazyOptions.context
      };
    }

    // skip is not supported when using lazy query execution.
    if (this.runLazy) {
      delete options.skip;
    }

    return options;
  }

  private runLazyQuery = (options?: QueryLazyOptions<TVariables>) => {
    this.cleanup();

    this.runLazy = true;
    this.lazyOptions = options;
    this.forceUpdate();
  };

  private getExecuteResult(): QueryResult<TData, TVariables> {
    const result = this.getQueryResult();
    this.startQuerySubscription();
    return result;
  };

  private getExecuteSsrResult() {
    const treeRenderingInitiated = this.context && this.context.renderPromises;
    const ssrDisabled = this.getOptions().ssr === false;
    const fetchDisabled = this.refreshClient().client.disableNetworkFetches;

    const ssrLoading = {
      loading: true,
      networkStatus: NetworkStatus.loading,
      called: true,
      data: undefined
    } as QueryResult<TData, TVariables>;

    // If SSR has been explicitly disabled, and this function has been called
    // on the server side, return the default loading state.
    if (ssrDisabled && (treeRenderingInitiated || fetchDisabled)) {
      return ssrLoading;
    }

    let result;
    if (treeRenderingInitiated) {
      result =
        this.context.renderPromises!.addQueryPromise(
          this,
          this.getQueryResult
        ) || ssrLoading;
    }

    return result;
  }

  private prepareObservableQueryOptions() {
    const options = this.getOptions();
    this.verifyDocumentType(options.query, DocumentType.Query);
    const displayName = options.displayName || 'Query';

    // Set the fetchPolicy to cache-first for network-only and cache-and-network
    // fetches for server side renders.
    if (
      this.context &&
      this.context.renderPromises &&
      (options.fetchPolicy === 'network-only' ||
        options.fetchPolicy === 'cache-and-network')
    ) {
      options.fetchPolicy = 'cache-first';
    }

    return {
      ...options,
      displayName,
      context: options.context,
    };
  }

  private initializeObservableQuery() {
    // See if there is an existing observable that was used to fetch the same
    // data and if so, use it instead since it will contain the proper queryId
    // to fetch the result set. This is used during SSR.
    if (this.context && this.context.renderPromises) {
      this.currentObservable = this.context.renderPromises.getSSRObservable(
        this.getOptions()
      );
    }

    if (!this.currentObservable) {
      const observableQueryOptions = this.prepareObservableQueryOptions();

      this.previousData.observableQueryOptions = {
        ...observableQueryOptions,
        children: null
      };
      this.currentObservable = this.refreshClient().client.watchQuery({
        ...observableQueryOptions
      });

      if (this.context && this.context.renderPromises) {
        this.context.renderPromises.registerSSRObservable(
          this.currentObservable,
          observableQueryOptions
        );
      }
    }
  }

  private updateObservableQuery() {
    // If we skipped initially, we may not have yet created the observable
    if (!this.currentObservable) {
      this.initializeObservableQuery();
      return;
    }

    const newObservableQueryOptions = {
      ...this.prepareObservableQueryOptions(),
      children: null
    };

    if (
      !equal(
        newObservableQueryOptions,
        this.previousData.observableQueryOptions
      )
    ) {
      this.previousData.observableQueryOptions = newObservableQueryOptions;
      this.currentObservable
        .setOptions(newObservableQueryOptions)
        // The error will be passed to the child container, so we don't
        // need to log it here. We could conceivably log something if
        // an option was set. OTOH we don't log errors w/ the original
        // query. See https://github.com/apollostack/react-apollo/issues/404
        .catch(() => {});
    }
  }

  // Setup a subscription to watch for Apollo Client `ObservableQuery` changes.
  // When new data is received, and it doesn't match the data that was used
  // during the last `QueryData.execute` call (and ultimately the last query
  // component render), trigger the `onNewData` callback. If not specified,
  // `onNewData` will trigger the `forceUpdate` function, which leads to a
  // query component re-render.
  private startQuerySubscription(onNewData: () => void = this.forceUpdate) {
    if (this.currentSubscription || this.getOptions().skip) return;
    this.currentSubscription = this.currentObservable!.subscribe({
      next: ({ loading, networkStatus, data }) => {
        const previousResult = this.previousData.result;

        // Make sure we're not attempting to re-render similar results
        if (
          previousResult &&
          previousResult.loading === loading &&
          previousResult.networkStatus === networkStatus &&
          equal(previousResult.data, data)
        ) {
          return;
        }

        // If we skipped previously, `previousResult.data` is set to undefined.
        // When this subscription is run after skipping, Apollo Client sends
        // the last query result data alongside the `loading` true state. This
        // means the previous skipped `data` of undefined and the incoming
        // data won't match, which would normally mean we want to trigger a
        // render to show the new data. In this case however we're already
        // showing the loading state, and want to avoid triggering an
        // additional and unnecessary render showing the same loading state.
        if (this.previousOptions.skip) {
          return;
        }

        onNewData();
      },
      error: error => {
        this.resubscribeToQuery();
        if (!error.hasOwnProperty('graphQLErrors')) throw error;

        const previousResult = this.previousData.result;
        if (
          (previousResult && previousResult.loading) ||
          !equal(error, this.previousData.error)
        ) {
          this.previousData.error = error;
          onNewData();
        }
      }
    });
  }

  private resubscribeToQuery() {
    this.removeQuerySubscription();

    // Unfortunately, if `lastError` is set in the current
    // `observableQuery` when the subscription is re-created,
    // the subscription will immediately receive the error, which will
    // cause it to terminate again. To avoid this, we first clear
    // the last error/result from the `observableQuery` before re-starting
    // the subscription, and restore it afterwards (so the subscription
    // has a chance to stay open).
    const { currentObservable } = this;
    if (currentObservable) {
      const lastError = currentObservable.getLastError();
      const lastResult = currentObservable.getLastResult();
      currentObservable.resetLastResults();
      this.startQuerySubscription();
      Object.assign(currentObservable, {
        lastError,
        lastResult
      });
    }
  }

  private getQueryResult = (): QueryResult<TData, TVariables> => {
    let result: any = this.observableQueryFields();
    const options = this.getOptions();

    // When skipping a query (ie. we're not querying for data but still want
    // to render children), make sure the `data` is cleared out and
    // `loading` is set to `false` (since we aren't loading anything).
    if (options.skip) {
      result = {
        ...result,
        data: undefined,
        error: undefined,
        loading: false,
        called: true
      };
    } else if (this.currentObservable) {
      // Fetch the current result (if any) from the store.
      const currentResult = this.currentObservable.getCurrentResult();
      const { loading, partial, networkStatus, errors } = currentResult;
      let { error, data } = currentResult;

      // Until a set naming convention for networkError and graphQLErrors is
      // decided upon, we map errors (graphQLErrors) to the error options.
      if (errors && errors.length > 0) {
        error = new ApolloError({ graphQLErrors: errors });
      }

      result = {
        ...result,
        loading,
        networkStatus,
        error,
        called: true
      };

      if (loading) {
        const previousData =
          this.previousData.result && this.previousData.result.data;
        result.data =
          previousData && data
            ? {
                ...previousData,
                ...data
              }
            : previousData || data;
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

        result.data = data;
      }
    }

    result.client = this.client;
    // Store options as this.previousOptions.
    this.setOptions(options, true);
    this.previousData.loading =
      this.previousData.result && this.previousData.result.loading || false;
    return this.previousData.result = result;
  }

  private handleErrorOrCompleted({
    data,
    loading,
    error,
  }: QueryResult<TData, TVariables>) {
    if (!loading) {
      const { query, variables, onCompleted, onError } = this.getOptions();

      // No changes, so we won't call onError/onCompleted.
      if (
        this.previousOptions &&
        !this.previousData.loading &&
        equal(this.previousOptions.query, query) &&
        equal(this.previousOptions.variables, variables)
      ) {
        return;
      }

      if (onCompleted && !error) {
        onCompleted(data);
      } else if (onError && error) {
        onError(error);
      }
    }
  }

  private removeQuerySubscription() {
    if (this.currentSubscription) {
      this.currentSubscription.unsubscribe();
      delete this.currentSubscription;
    }
  }

  private obsRefetch = (variables?: TVariables) =>
    this.currentObservable!.refetch(variables);

  private obsFetchMore = <K extends keyof TVariables>(
    fetchMoreOptions: FetchMoreQueryOptions<TVariables, K> &
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
