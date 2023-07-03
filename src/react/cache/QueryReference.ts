import type {
  ApolloError,
  ApolloQueryResult,
  ObservableQuery,
  OperationVariables,
  WatchQueryOptions,
} from '../../core';
import { NetworkStatus, isNetworkRequestSettled } from '../../core';
import type { ObservableSubscription } from '../../utilities';
import { createFulfilledPromise, createRejectedPromise } from '../../utilities';
import type { CacheKey } from './types';
import type { useBackgroundQuery, useReadQuery } from '../hooks';

type Listener<TData> = (promise: Promise<ApolloQueryResult<TData>>) => void;

type FetchMoreOptions<TData> = Parameters<
  ObservableQuery<TData>['fetchMore']
>[0];

export const QUERY_REFERENCE_SYMBOL: unique symbol = Symbol();
/**
 * A `QueryReference` is an opaque object returned by {@link useBackgroundQuery}.
 * A child component reading the `QueryReference` via {@link useReadQuery} will
 * suspend until the promise resolves.
 */
export interface QueryReference<TData = unknown> {
  [QUERY_REFERENCE_SYMBOL]: InternalQueryReference<TData>;
}

interface InternalQueryReferenceOptions {
  key: CacheKey;
  onDispose?: () => void;
  autoDisposeTimeoutMs?: number;
}

export class InternalQueryReference<TData = unknown> {
  public result: ApolloQueryResult<TData>;
  public readonly key: CacheKey;
  public readonly observable: ObservableQuery<TData>;

  public promiseCache?: Map<any[], Promise<ApolloQueryResult<TData>>>;
  public promise: Promise<ApolloQueryResult<TData>>;

  private subscription: ObservableSubscription;
  private listeners = new Set<Listener<TData>>();
  private autoDisposeTimeoutId: NodeJS.Timeout;
  private status: 'idle' | 'loading' = 'loading';

  private resolve: ((result: ApolloQueryResult<TData>) => void) | undefined;
  private reject: ((error: unknown) => void) | undefined;

  constructor(
    observable: ObservableQuery<TData>,
    options: InternalQueryReferenceOptions
  ) {
    this.listen = this.listen.bind(this);
    this.handleNext = this.handleNext.bind(this);
    this.handleError = this.handleError.bind(this);
    this.dispose = this.dispose.bind(this);
    this.observable = observable;
    this.result = observable.getCurrentResult(false);
    this.key = options.key;

    if (options.onDispose) {
      this.onDispose = options.onDispose;
    }

    if (
      isNetworkRequestSettled(this.result.networkStatus) ||
      (this.result.data &&
        (!this.result.partial || this.observable.options.returnPartialData))
    ) {
      this.promise = createFulfilledPromise(this.result);
      this.status = 'idle';
    }

    this.subscription = observable.subscribe({
      next: this.handleNext,
      error: this.handleError,
    });

    if (!this.promise) {
      this.promise = new Promise((resolve, reject) => {
        this.resolve = resolve;
        this.reject = reject;
      });
    }

    // Start a timer that will automatically dispose of the query if the
    // suspended resource does not use this queryRef in the given time. This
    // helps prevent memory leaks when a component has unmounted before the
    // query has finished loading.
    this.autoDisposeTimeoutId = setTimeout(
      this.dispose,
      options.autoDisposeTimeoutMs ?? 30_000
    );
  }

  get watchQueryOptions() {
    return this.observable.options;
  }

  listen(listener: Listener<TData>) {
    // As soon as the component listens for updates, we know it has finished
    // suspending and is ready to receive updates, so we can remove the auto
    // dispose timer.
    clearTimeout(this.autoDisposeTimeoutId);

    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  refetch(variables: OperationVariables | undefined) {
    const promise = this.observable.refetch(variables);

    this.promise = promise;

    return promise;
  }

  fetchMore(options: FetchMoreOptions<TData>) {
    const promise = this.observable.fetchMore<TData>(options);

    this.promise = promise;

    return promise;
  }

  reobserve(
    watchQueryOptions: Partial<WatchQueryOptions<OperationVariables, TData>>
  ) {
    const promise = this.observable.reobserve(watchQueryOptions);

    this.promise = promise;

    return promise;
  }

  dispose() {
    this.subscription.unsubscribe();
    this.onDispose();
  }

  private onDispose() {
    // noop. overridable by options
  }

  private handleNext(result: ApolloQueryResult<TData>) {
    // If we encounter an error with the new result after we have successfully
    // fetched a previous result, set the new result data to the last successful
    // result.
    if (this.result.data && result.data === void 0) {
      result.data = this.result.data;
    }

    switch (this.status) {
      case 'loading': {
        if (!isNetworkRequestSettled(result.networkStatus)) {
          return;
        }

        this.status = 'idle';
        this.result = result;
        this.resolve?.(result);
        break;
      }
      case 'idle': {
        if (result.data === this.result.data) {
          return;
        }

        this.result = result;
        this.promise = createFulfilledPromise(result);
        this.deliver(this.promise);
        break;
      }
    }
  }

  private handleError(error: ApolloError) {
    switch (this.status) {
      case 'loading': {
        this.status = 'idle';
        this.reject?.(error);
        break;
      }
      case 'idle': {
        this.promise = createRejectedPromise(error);
        this.deliver(this.promise);
      }
    }
  }

  private deliver(promise: Promise<ApolloQueryResult<TData>>) {
    this.listeners.forEach((listener) => listener(promise));
  }
}
