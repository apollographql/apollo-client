import { equal } from '@wry/equality';
import type {
  ApolloError,
  ApolloQueryResult,
  ObservableQuery,
  OperationVariables,
  WatchQueryOptions,
} from '../../core/index.js';
import { isNetworkRequestSettled } from '../../core/index.js';
import type { ObservableSubscription } from '../../utilities/index.js';
import {
  createFulfilledPromise,
  createRejectedPromise,
} from '../../utilities/index.js';
import type { CacheKey } from './types.js';
import type { useBackgroundQuery, useReadQuery } from '../hooks/index.js';

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

const OBSERVED_CHANGED_OPTIONS: Array<keyof WatchQueryOptions> = [
  'canonizeResults',
  'context',
  'errorPolicy',
  'fetchPolicy',
  'refetchWritePolicy',
  'returnPartialData',
];

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

  private references = 0;

  constructor(
    observable: ObservableQuery<TData>,
    options: InternalQueryReferenceOptions
  ) {
    this.listen = this.listen.bind(this);
    this.handleNext = this.handleNext.bind(this);
    this.handleError = this.handleError.bind(this);
    this.initiateFetch = this.initiateFetch.bind(this);
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
        (!this.result.partial || this.watchQueryOptions.returnPartialData))
    ) {
      this.promise = createFulfilledPromise(this.result);
      this.status = 'idle';
    } else {
      this.promise = new Promise((resolve, reject) => {
        this.resolve = resolve;
        this.reject = reject;
      });
    }

    this.subscription = observable
      .filter(({ data }) => !equal(data, {}))
      .subscribe({
        next: this.handleNext,
        error: this.handleError,
      });

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

  retain() {
    this.references++;
    clearTimeout(this.autoDisposeTimeoutId);
    let disposed = false;

    return () => {
      if (disposed) {
        return;
      }

      disposed = true;
      this.references--;

      // Wait before fully disposing in case the app is running in strict mode.
      setTimeout(() => {
        if (!this.references) {
          this.dispose();
        }
      });
    };
  }

  didChangeOptions(watchQueryOptions: WatchQueryOptions) {
    return OBSERVED_CHANGED_OPTIONS.some(
      (option) =>
        !equal(this.watchQueryOptions[option], watchQueryOptions[option])
    );
  }

  applyOptions(watchQueryOptions: WatchQueryOptions) {
    const {
      fetchPolicy: currentFetchPolicy,
      canonizeResults: currentCanonizeResults,
    } = this.watchQueryOptions;

    // "standby" is used when `skip` is set to `true`. Detect when we've
    // enabled the query (i.e. `skip` is `false`) to execute a network request.
    if (
      currentFetchPolicy === 'standby' &&
      currentFetchPolicy !== watchQueryOptions.fetchPolicy
    ) {
      this.observable.reobserve(watchQueryOptions);
      this.initiateFetch();
    } else {
      this.observable.silentSetOptions(watchQueryOptions);

      if (currentCanonizeResults !== watchQueryOptions.canonizeResults) {
        this.result = { ...this.result, ...this.observable.getCurrentResult() };
        this.promise = createFulfilledPromise(this.result);
      }
    }

    return this.promise;
  }

  listen(listener: Listener<TData>) {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  refetch(variables: OperationVariables | undefined) {
    const promise = this.observable.refetch(variables);

    this.initiateFetch();

    return promise;
  }

  fetchMore(options: FetchMoreOptions<TData>) {
    const promise = this.observable.fetchMore<TData>(options);

    this.initiateFetch();

    return promise;
  }

  private dispose() {
    this.subscription.unsubscribe();
    this.onDispose();
  }

  private onDispose() {
    // noop. overridable by options
  }

  private handleNext(result: ApolloQueryResult<TData>) {
    switch (this.status) {
      case 'loading': {
        // Maintain the last successful `data` value if the next result does not
        // have one.
        if (result.data === void 0) {
          result.data = this.result.data;
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

        // Maintain the last successful `data` value if the next result does not
        // have one.
        if (result.data === void 0) {
          result.data = this.result.data;
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

  private initiateFetch() {
    this.status = 'loading';

    this.promise = new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });

    this.promise.catch(() => {});
  }
}
