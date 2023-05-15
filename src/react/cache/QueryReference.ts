import type {
  ApolloError,
  ApolloQueryResult,
  ObservableQuery,
  OperationVariables,
} from '../../core';
import { NetworkStatus } from '../../core';
import { isNetworkRequestSettled } from '../../core';
import type { ObservableSubscription } from '../../utilities';
import { createFulfilledPromise, createRejectedPromise } from '../../utilities';
import type { CacheKey } from './types';

type Listener<TData> = (promise: Promise<ApolloQueryResult<TData>>) => void;

type FetchMoreOptions<TData> = Parameters<
  ObservableQuery<TData>['fetchMore']
>[0];

interface QueryReferenceOptions {
  key: CacheKey;
  onDispose?: () => void;
  autoDisposeTimeoutMs?: number;
}

export class QueryReference<TData = unknown> {
  public result: ApolloQueryResult<TData>;
  public readonly key: CacheKey;
  public readonly observable: ObservableQuery<TData>;

  public promiseCache?: Map<any[], Promise<ApolloQueryResult<TData>>>;
  public promise: Promise<ApolloQueryResult<TData>>;

  private subscription: ObservableSubscription;
  private listeners = new Set<Listener<TData>>();
  private autoDisposeTimeoutId: NodeJS.Timeout;
  private initialized = false;
  private refetching = false;

  private resolve: (result: ApolloQueryResult<TData>) => void;
  private reject: (error: unknown) => void;

  constructor(
    observable: ObservableQuery<TData>,
    options: QueryReferenceOptions
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
      this.initialized = true;
      this.refetching = false;
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
    this.refetching = true;

    const promise = this.observable.refetch(variables);

    this.promise = promise;

    return promise;
  }

  fetchMore(options: FetchMoreOptions<TData>) {
    const promise = this.observable.fetchMore<TData>(options);

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
    if (!this.initialized) {
      if (!isNetworkRequestSettled(result.networkStatus)) {
        return;
      }
      this.initialized = true;
      this.result = result;
      this.resolve(result);
      return;
    }

    if (result.data === this.result.data) {
      return;
    }

    // If we encounter an error with the new result after we have successfully
    // fetched a previous result, set the new result data to the last successful
    // result.
    if (this.result.data && result.data === void 0) {
      result.data = this.result.data;
    }

    this.result = result;
    this.promise = createFulfilledPromise(result);
    this.deliver(this.promise);
  }

  private handleError(error: ApolloError) {
    const result = {
      ...this.result,
      error,
      networkStatus: NetworkStatus.error,
    };

    this.result = result;

    if (!this.initialized || this.refetching) {
      this.initialized = true;
      this.refetching = false;
      this.reject(error);
      return;
    }

    this.result = result;
    this.promise = result.data
      ? createFulfilledPromise(result)
      : createRejectedPromise(result);
    this.deliver(this.promise);
  }

  private deliver(promise: Promise<ApolloQueryResult<TData>>) {
    this.listeners.forEach((listener) => listener(promise));
  }
}
