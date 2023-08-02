import { equal } from "@wry/equality";
import type {
  ApolloError,
  ApolloQueryResult,
  ObservableQuery,
  OperationVariables,
  WatchQueryOptions,
} from "../../core/index.js";
import { isNetworkRequestSettled } from "../../core/index.js";
import type { ObservableSubscription } from "../../utilities/index.js";
import {
  createFulfilledPromise,
  createRejectedPromise,
} from "../../utilities/index.js";
import type { CacheKey } from "./types.js";
import type { useBackgroundQuery, useReadQuery } from "../hooks/index.js";

type Listener<TData> = (promise: Promise<ApolloQueryResult<TData>>) => void;

type FetchMoreOptions<TData> = Parameters<
  ObservableQuery<TData>["fetchMore"]
>[0];

const QUERY_REFERENCE_SYMBOL: unique symbol = Symbol();
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

export function wrapQueryRef<TData>(
  internalQueryRef: InternalQueryReference<TData>
): QueryReference<TData> {
  return { [QUERY_REFERENCE_SYMBOL]: internalQueryRef };
}

export function unwrapQueryRef<TData>(
  queryRef: QueryReference<TData>
): InternalQueryReference<TData> {
  return queryRef[QUERY_REFERENCE_SYMBOL];
}

const OBSERVED_CHANGED_OPTIONS = [
  "canonizeResults",
  "context",
  "errorPolicy",
  "fetchPolicy",
  "refetchWritePolicy",
  "returnPartialData",
] as const;

type ObservedOptions = Pick<
  WatchQueryOptions,
  typeof OBSERVED_CHANGED_OPTIONS[number]
>;

export class InternalQueryReference<TData = unknown> {
  public result: ApolloQueryResult<TData>;
  public readonly key: CacheKey;
  public readonly observable: ObservableQuery<TData>;

  public promiseCache?: Map<CacheKey, Promise<ApolloQueryResult<TData>>>;
  public promise: Promise<ApolloQueryResult<TData>>;

  private subscription: ObservableSubscription;
  private listeners = new Set<Listener<TData>>();
  private autoDisposeTimeoutId: NodeJS.Timeout;
  private status: "idle" | "loading" = "loading";

  private resolve: ((result: ApolloQueryResult<TData>) => void) | undefined;
  private reject: ((error: unknown) => void) | undefined;

  private references = 0;

  constructor(
    observable: ObservableQuery<TData>,
    options: InternalQueryReferenceOptions
  ) {
    this.handleNext = this.handleNext.bind(this);
    this.handleError = this.handleError.bind(this);
    this.dispose = this.dispose.bind(this);
    this.observable = observable;
    // Don't save this result as last result to prevent delivery of last result
    // when first subscribing
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
      this.status = "idle";
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

  didChangeOptions(watchQueryOptions: ObservedOptions) {
    return OBSERVED_CHANGED_OPTIONS.some(
      (option) =>
        !equal(this.watchQueryOptions[option], watchQueryOptions[option])
    );
  }

  applyOptions(watchQueryOptions: ObservedOptions) {
    const {
      fetchPolicy: currentFetchPolicy,
      canonizeResults: currentCanonizeResults,
    } = this.watchQueryOptions;

    // "standby" is used when `skip` is set to `true`. Detect when we've
    // enabled the query (i.e. `skip` is `false`) to execute a network request.
    if (
      currentFetchPolicy === "standby" &&
      currentFetchPolicy !== watchQueryOptions.fetchPolicy
    ) {
      this.initiateFetch(this.observable.reobserve(watchQueryOptions));
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
    return this.initiateFetch(this.observable.refetch(variables));
  }

  fetchMore(options: FetchMoreOptions<TData>) {
    return this.initiateFetch(this.observable.fetchMore<TData>(options));
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
      case "loading": {
        // Maintain the last successful `data` value if the next result does not
        // have one.
        if (result.data === void 0) {
          result.data = this.result.data;
        }
        this.status = "idle";
        this.result = result;
        this.resolve?.(result);
        break;
      }
      case "idle": {
        // This occurs when switching to a result that is fully cached when this
        // class is instantiated. ObservableQuery will run reobserve when
        // subscribing, which delivers a result from the cache.
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
      case "loading": {
        this.status = "idle";
        this.reject?.(error);
        break;
      }
      case "idle": {
        this.promise = createRejectedPromise(error);
        this.deliver(this.promise);
      }
    }
  }

  private deliver(promise: Promise<ApolloQueryResult<TData>>) {
    this.listeners.forEach((listener) => listener(promise));
  }

  private initiateFetch(returnedPromise: Promise<ApolloQueryResult<TData>>) {
    this.status = "loading";

    this.promise = new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });

    this.promise.catch(() => {});

    // If the data returned from the fetch is deeply equal to the data already
    // in the cache, `handleNext` will not be triggered leaving the promise we
    // created in a pending state forever. To avoid this situtation, we attempt
    // to resolve the promise if `handleNext` hasn't been run to ensure the
    // promise is resolved correctly.
    returnedPromise
      .then((result) => {
        if (this.status === "loading") {
          this.status = "idle";
          this.result = result;
          this.resolve?.(result);
        }
      })
      .catch(() => {});

    return returnedPromise;
  }
}
