import { equal } from "@wry/equality";
import type { Subscription } from "rxjs";
import { filter } from "rxjs";

import type {
  ApolloClient,
  DataState,
  ObservableQuery,
  OperationVariables,
} from "@apollo/client";
import type { MaybeMasked } from "@apollo/client/masking";
import type { DecoratedPromise } from "@apollo/client/utilities/internal";
import {
  createFulfilledPromise,
  createRejectedPromise,
  decoratePromise,
} from "@apollo/client/utilities/internal";
import { invariant } from "@apollo/client/utilities/invariant";

import type { QueryKey } from "./types.js";

type QueryRefPromise<
  TData,
  TStates extends DataState<TData>["dataState"],
> = DecoratedPromise<ObservableQuery.Result<MaybeMasked<TData>, TStates>>;

type Listener<TData, TStates extends DataState<TData>["dataState"]> = (
  promise: QueryRefPromise<TData, TStates>
) => void;

const QUERY_REFERENCE_SYMBOL: unique symbol = Symbol.for(
  "apollo.internal.queryRef"
);
const PROMISE_SYMBOL: unique symbol = Symbol.for("apollo.internal.refPromise");
declare const QUERY_REF_BRAND: unique symbol;
declare const PRELOADED_QUERY_REF_BRAND: unique symbol;
/**
 * A `QueryReference` is an opaque object returned by `useBackgroundQuery`.
 * A child component reading the `QueryReference` via `useReadQuery` will
 * suspend until the promise resolves.
 */
export interface QueryRef<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
  TStates extends DataState<TData>["dataState"] = "complete" | "streaming",
> {
  /** @internal */
  [QUERY_REF_BRAND]?(variables: TVariables): { data: TData; states: TStates };
}

/**
 * @internal
 * For usage in internal helpers only.
 */
interface WrappedQueryRef<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
  TStates extends DataState<TData>["dataState"] = "complete" | "streaming",
> extends QueryRef<TData, TVariables, TStates> {
  /** @internal */
  readonly [QUERY_REFERENCE_SYMBOL]: InternalQueryReference<TData, TStates>;
  /** @internal */
  [PROMISE_SYMBOL]: QueryRefPromise<TData, TStates>;
}

/**
 * {@inheritDoc @apollo/client/react!QueryRef:interface}
 */
export interface PreloadedQueryRef<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
  TStates extends DataState<TData>["dataState"] = "complete" | "streaming",
> extends QueryRef<TData, TVariables, TStates> {
  /** @internal */
  [PRELOADED_QUERY_REF_BRAND]: typeof PRELOADED_QUERY_REF_BRAND;
}

interface InternalQueryReferenceOptions {
  onDispose?: () => void;
  autoDisposeTimeoutMs?: number;
}

export function wrapQueryRef<
  TData,
  TVariables extends OperationVariables,
  TStates extends DataState<TData>["dataState"],
>(internalQueryRef: InternalQueryReference<TData, TStates>) {
  return {
    [QUERY_REFERENCE_SYMBOL]: internalQueryRef,
    [PROMISE_SYMBOL]: internalQueryRef.promise,
  } as WrappedQueryRef<TData, TVariables, TStates>;
}

export function assertWrappedQueryRef<
  TData,
  TVariables extends OperationVariables,
  TStates extends DataState<TData>["dataState"],
>(
  queryRef: QueryRef<TData, TVariables, TStates>
): asserts queryRef is WrappedQueryRef<TData, TVariables, TStates>;

export function assertWrappedQueryRef<
  TData,
  TVariables extends OperationVariables,
  TStates extends DataState<TData>["dataState"],
>(
  queryRef: QueryRef<TData, TVariables, TStates> | undefined | null
): asserts queryRef is
  | WrappedQueryRef<TData, TVariables, TStates>
  | undefined
  | null;

export function assertWrappedQueryRef<
  TData,
  TVariables extends OperationVariables,
  TStates extends DataState<TData>["dataState"],
>(queryRef: QueryRef<TData, TVariables, TStates> | undefined | null) {
  invariant(
    !queryRef || QUERY_REFERENCE_SYMBOL in queryRef,
    "Expected a QueryRef object, but got something else instead."
  );
}

export function getWrappedPromise<
  TData,
  TStates extends DataState<TData>["dataState"],
>(queryRef: WrappedQueryRef<TData, any, TStates>) {
  const internalQueryRef = unwrapQueryRef(queryRef);

  return internalQueryRef.promise.status === "fulfilled" ?
      internalQueryRef.promise
    : queryRef[PROMISE_SYMBOL];
}

export function unwrapQueryRef<
  TData,
  TStates extends DataState<TData>["dataState"],
>(
  queryRef: WrappedQueryRef<TData, any, TStates>
): InternalQueryReference<TData, TStates>;

export function unwrapQueryRef<
  TData,
  TStates extends DataState<TData>["dataState"],
>(
  queryRef: Partial<WrappedQueryRef<TData, any, TStates>>
): undefined | InternalQueryReference<TData, TStates>;

export function unwrapQueryRef<
  TData,
  TStates extends DataState<TData>["dataState"],
>(queryRef: Partial<WrappedQueryRef<TData, any, TStates>>) {
  return queryRef[QUERY_REFERENCE_SYMBOL];
}

export function updateWrappedQueryRef<
  TData,
  TStates extends DataState<TData>["dataState"],
>(
  queryRef: WrappedQueryRef<TData, any, TStates>,
  promise: QueryRefPromise<TData, TStates>
) {
  queryRef[PROMISE_SYMBOL] = promise;
}

const OBSERVED_CHANGED_OPTIONS = [
  "context",
  "errorPolicy",
  "fetchPolicy",
  "refetchWritePolicy",
  "returnPartialData",
] as const;

type ObservedOptions = Pick<
  ApolloClient.WatchQueryOptions,
  (typeof OBSERVED_CHANGED_OPTIONS)[number]
>;

export class InternalQueryReference<
  TData = unknown,
  TStates extends DataState<TData>["dataState"] = DataState<TData>["dataState"],
> {
  public result!: ObservableQuery.Result<MaybeMasked<TData>, TStates>;
  public readonly key: QueryKey = {};
  public readonly observable: ObservableQuery<TData>;

  public promise!: QueryRefPromise<TData, TStates>;

  private subscription!: Subscription;
  private listeners = new Set<Listener<TData, TStates>>();
  private autoDisposeTimeoutId?: NodeJS.Timeout;

  private resolve:
    | ((result: ObservableQuery.Result<MaybeMasked<TData>, TStates>) => void)
    | undefined;
  private reject: ((error: unknown) => void) | undefined;

  private references = 0;
  private softReferences = 0;

  constructor(
    observable: ObservableQuery<TData, any>,
    options: InternalQueryReferenceOptions
  ) {
    this.handleNext = this.handleNext.bind(this);
    this.dispose = this.dispose.bind(this);
    this.observable = observable;

    if (options.onDispose) {
      this.onDispose = options.onDispose;
    }

    this.setResult();
    this.subscribeToQuery();

    // Start a timer that will automatically dispose of the query if the
    // suspended resource does not use this queryRef in the given time. This
    // helps prevent memory leaks when a component has unmounted before the
    // query has finished loading.
    const startDisposeTimer = () => {
      if (!this.references) {
        this.autoDisposeTimeoutId = setTimeout(
          this.dispose,
          options.autoDisposeTimeoutMs ?? 30_000
        );
      }
    };

    // We wait until the request has settled to ensure we don't dispose of the
    // query ref before the request finishes, otherwise we would leave the
    // promise in a pending state rendering the suspense boundary indefinitely.
    this.promise.then(startDisposeTimer, startDisposeTimer);
  }

  get disposed() {
    return this.subscription.closed;
  }

  get watchQueryOptions() {
    return this.observable.options;
  }

  reinitialize() {
    const { observable } = this;

    const originalFetchPolicy = this.watchQueryOptions.fetchPolicy;
    const avoidNetworkRequests =
      originalFetchPolicy === "no-cache" || originalFetchPolicy === "standby";

    try {
      if (avoidNetworkRequests) {
        observable.applyOptions({ fetchPolicy: "standby" });
      } else {
        observable.reset();
        observable.applyOptions({ fetchPolicy: "cache-first" });
      }

      if (!avoidNetworkRequests) {
        this.setResult();
      }
      this.subscribeToQuery();
    } finally {
      observable.applyOptions({ fetchPolicy: originalFetchPolicy });
    }
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

      setTimeout(() => {
        if (!this.references) {
          this.dispose();
        }
      });
    };
  }

  softRetain() {
    this.softReferences++;
    let disposed = false;

    return () => {
      // Tracking if this has already been called helps ensure that
      // multiple calls to this function won't decrement the reference
      // counter more than it should. Subsequent calls just result in a noop.
      if (disposed) {
        return;
      }

      disposed = true;
      this.softReferences--;
      setTimeout(() => {
        if (!this.softReferences && !this.references) {
          this.dispose();
        }
      });
    };
  }

  didChangeOptions(watchQueryOptions: ObservedOptions) {
    return OBSERVED_CHANGED_OPTIONS.some(
      (option) =>
        option in watchQueryOptions &&
        !equal(this.watchQueryOptions[option], watchQueryOptions[option])
    );
  }

  applyOptions(watchQueryOptions: ObservedOptions) {
    const { fetchPolicy: currentFetchPolicy } = this.watchQueryOptions;

    // "standby" is used when `skip` is set to `true`. Detect when we've
    // enabled the query (i.e. `skip` is `false`) to execute a network request.
    if (
      currentFetchPolicy === "standby" &&
      currentFetchPolicy !== watchQueryOptions.fetchPolicy
    ) {
      this.initiateFetch(this.observable.reobserve(watchQueryOptions));
    } else {
      this.observable.applyOptions(watchQueryOptions);
    }

    return this.promise;
  }

  listen(listener: Listener<TData, TStates>) {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  refetch(variables: OperationVariables | undefined) {
    return this.initiateFetch(this.observable.refetch(variables));
  }

  fetchMore(options: ObservableQuery.FetchMoreOptions<TData, any, any, any>) {
    return this.initiateFetch(this.observable.fetchMore<TData>(options));
  }

  private dispose() {
    this.subscription.unsubscribe();
  }

  private onDispose() {
    // noop. overridable by options
  }

  private handleNext(
    result: ObservableQuery.Result<MaybeMasked<TData>, TStates>
  ) {
    switch (this.promise.status) {
      case "pending": {
        // Maintain the last successful `data` value if the next result does not
        // have one.
        // TODO: This can likely be removed once
        // https://github.com/apollographql/apollo-client/issues/12667 is fixed
        if (result.data === void 0) {
          result.data = this.result.data;

          if (result.data) {
            result.dataState = "complete" as any;
          }
        }

        if (this.shouldReject(result)) {
          this.reject?.(result.error);
        } else {
          this.result = result;
          this.resolve?.(result);
        }
        break;
      }
      default: {
        // This occurs when switching to a result that is fully cached when this
        // class is instantiated. ObservableQuery will run reobserve when
        // subscribing, which delivers a result from the cache.
        if (
          result.data === this.result.data &&
          result.networkStatus === this.result.networkStatus
        ) {
          return;
        }

        // Maintain the last successful `data` value if the next result does not
        // have one.
        if (result.data === void 0) {
          result.data = this.result.data;
        }

        if (this.shouldReject(result)) {
          this.promise = createRejectedPromise(result.error);
          this.deliver(this.promise);
        } else {
          this.result = result;
          this.promise = createFulfilledPromise(result);
          this.deliver(this.promise);
        }
        break;
      }
    }
  }

  private deliver(promise: QueryRefPromise<TData, TStates>) {
    this.listeners.forEach((listener) => listener(promise));
  }

  private initiateFetch(
    returnedPromise: Promise<ApolloClient.QueryResult<MaybeMasked<TData>>>
  ) {
    this.promise = this.createPendingPromise();
    this.promise.catch(() => {});

    // If the data returned from the fetch is deeply equal to the data already
    // in the cache, `handleNext` will not be triggered leaving the promise we
    // created in a pending state forever. To avoid this situation, we attempt
    // to resolve the promise if `handleNext` hasn't been run to ensure the
    // promise is resolved correctly.
    returnedPromise
      .then(() => {
        // In the case of `fetchMore`, this promise is resolved before a cache
        // result is emitted due to the fact that `fetchMore` sets a `no-cache`
        // fetch policy and runs `cache.batch` in its `.then` handler. Because
        // the timing is different, we accidentally run this update twice
        // causing an additional re-render with the `fetchMore` result by
        // itself. By wrapping in `setTimeout`, this should provide a short
        // delay to allow the `QueryInfo.notify` handler to run before this
        // promise is checked.
        // See https://github.com/apollographql/apollo-client/issues/11315 for
        // more information
        setTimeout(() => {
          if (this.promise.status === "pending") {
            // Use the current result from the observable instead of the value
            // resolved from the promise. This avoids issues in some cases where
            // the raw resolved value should not be the emitted value, such as
            // when a `fetchMore` call returns an empty array after it has
            // reached the end of the list.
            //
            // See the following for more information:
            // https://github.com/apollographql/apollo-client/issues/11642
            this.result =
              this.observable.getCurrentResult() as ObservableQuery.Result<
                TData,
                TStates
              >;
            this.resolve?.(this.result);
          }
        });
      })
      .catch((error) => this.reject?.(error));

    return returnedPromise;
  }

  private subscribeToQuery() {
    this.subscription = this.observable
      .pipe(filter((result) => !equal(result, this.result)))
      .subscribe(this.handleNext as any);
    // call `onDispose` when the subscription is finalized, either because it is
    // unsubscribed as a consequence of a `dispose` call or because the
    // ObservableQuery completes because of a `ApolloClient.stop()` call.
    this.subscription.add(this.onDispose);
  }

  private setResult() {
    const result = this.observable.getCurrentResult() as ObservableQuery.Result<
      TData,
      TStates
    >;

    if (equal(result, this.result)) {
      return;
    }

    this.result = result;
    this.promise =
      result.data ?
        createFulfilledPromise(result)
      : this.createPendingPromise();
  }

  private shouldReject(result: ObservableQuery.Result<any>) {
    const { errorPolicy = "none" } = this.watchQueryOptions;

    return result.error && errorPolicy === "none";
  }

  private createPendingPromise() {
    return decoratePromise(
      new Promise<ObservableQuery.Result<MaybeMasked<TData>, TStates>>(
        (resolve, reject) => {
          this.resolve = resolve;
          this.reject = reject;
        }
      )
    );
  }
}
