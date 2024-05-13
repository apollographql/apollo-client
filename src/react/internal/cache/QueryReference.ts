import { equal } from "@wry/equality";
import type {
  ApolloError,
  ApolloQueryResult,
  ObservableQuery,
  OperationVariables,
  WatchQueryOptions,
} from "../../../core/index.js";
import type {
  ObservableSubscription,
  PromiseWithState,
} from "../../../utilities/index.js";
import {
  createFulfilledPromise,
  createRejectedPromise,
} from "../../../utilities/index.js";
import type { QueryKey } from "./types.js";
import { wrapPromiseWithState } from "../../../utilities/index.js";
import { invariant } from "../../../utilities/globals/invariantWrappers.js";

type QueryRefPromise<TData> = PromiseWithState<ApolloQueryResult<TData>>;

type Listener<TData> = (promise: QueryRefPromise<TData>) => void;

type FetchMoreOptions<TData> = Parameters<
  ObservableQuery<TData>["fetchMore"]
>[0];

const QUERY_REFERENCE_SYMBOL: unique symbol = Symbol();
const PROMISE_SYMBOL: unique symbol = Symbol();
declare const QUERY_REF_BRAND: unique symbol;
/**
 * A `QueryReference` is an opaque object returned by `useBackgroundQuery`.
 * A child component reading the `QueryReference` via `useReadQuery` will
 * suspend until the promise resolves.
 */
export interface QueryRef<TData = unknown, TVariables = unknown> {
  /** @internal */
  [QUERY_REF_BRAND]?(variables: TVariables): TData;
}

/**
 * @internal
 * For usage in internal helpers only.
 */
interface WrappedQueryRef<TData = unknown, TVariables = unknown>
  extends QueryRef<TData, TVariables> {
  /** @internal */
  readonly [QUERY_REFERENCE_SYMBOL]: InternalQueryReference<TData>;
  /** @internal */
  [PROMISE_SYMBOL]: QueryRefPromise<TData>;
  /** @internal */
  toPromise?(): Promise<unknown>;
}

/**
 * @deprecated Please use the `QueryRef` interface instead of `QueryReference`.
 *
 * {@inheritDoc @apollo/client!QueryRef:interface}
 */
export interface QueryReference<TData = unknown, TVariables = unknown>
  extends QueryRef<TData, TVariables> {
  /**
   * @deprecated Please use the `QueryRef` interface instead of `QueryReference`.
   *
   * {@inheritDoc @apollo/client!PreloadedQueryRef#toPromise:member(1)}
   */
  toPromise?: unknown;
}

/**
 * {@inheritDoc @apollo/client!QueryRef:interface}
 */
export interface PreloadedQueryRef<TData = unknown, TVariables = unknown>
  extends QueryRef<TData, TVariables> {
  /**
   * A function that returns a promise that resolves when the query has finished
   * loading. The promise resolves with the `QueryReference` itself.
   *
   * @remarks
   * This method is useful for preloading queries in data loading routers, such
   * as [React Router](https://reactrouter.com/en/main) or [TanStack Router](https://tanstack.com/router),
   * to prevent routes from transitioning until the query has finished loading.
   * `data` is not exposed on the promise to discourage using the data in
   * `loader` functions and exposing it to your route components. Instead, we
   * prefer you rely on `useReadQuery` to access the data to ensure your
   * component can rerender with cache updates. If you need to access raw query
   * data, use `client.query()` directly.
   *
   * @example
   * Here's an example using React Router's `loader` function:
   * ```ts
   * import { createQueryPreloader } from "@apollo/client";
   *
   * const preloadQuery = createQueryPreloader(client);
   *
   * export async function loader() {
   *   const queryRef = preloadQuery(GET_DOGS_QUERY);
   *
   *   return queryRef.toPromise();
   * }
   *
   * export function RouteComponent() {
   *   const queryRef = useLoaderData();
   *   const { data } = useReadQuery(queryRef);
   *
   *   // ...
   * }
   * ```
   *
   * @since 3.9.0
   */
  toPromise(): Promise<PreloadedQueryRef<TData, TVariables>>;
}

interface InternalQueryReferenceOptions {
  onDispose?: () => void;
  autoDisposeTimeoutMs?: number;
}

export function wrapQueryRef<TData, TVariables extends OperationVariables>(
  internalQueryRef: InternalQueryReference<TData>
) {
  const ref: WrappedQueryRef<TData, TVariables> = {
    toPromise() {
      // We avoid resolving this promise with the query data because we want to
      // discourage using the server data directly from the queryRef. Instead,
      // the data should be accessed through `useReadQuery`. When the server
      // data is needed, its better to use `client.query()` directly.
      //
      // Here we resolve with the ref itself to make using this in React Router
      // or TanStack Router `loader` functions a bit more ergonomic e.g.
      //
      // function loader() {
      //   return { queryRef: await preloadQuery(query).toPromise() }
      // }
      return getWrappedPromise(ref).then(() => ref);
    },
    [QUERY_REFERENCE_SYMBOL]: internalQueryRef,
    [PROMISE_SYMBOL]: internalQueryRef.promise,
  };

  return ref;
}

export function assertWrappedQueryRef<TData, TVariables>(
  queryRef: QueryRef<TData, TVariables>
): asserts queryRef is WrappedQueryRef<TData, TVariables>;
export function assertWrappedQueryRef<TData, TVariables>(
  queryRef: QueryRef<TData, TVariables> | undefined | null
): asserts queryRef is WrappedQueryRef<TData, TVariables> | undefined | null;
export function assertWrappedQueryRef<TData, TVariables>(
  queryRef: QueryRef<TData, TVariables> | undefined | null
) {
  invariant(
    !queryRef || QUERY_REFERENCE_SYMBOL in queryRef,
    "Expected a QueryRef object, but got something else instead."
  );
}

export function getWrappedPromise<TData>(
  queryRef: WrappedQueryRef<TData, any>
) {
  const internalQueryRef = unwrapQueryRef(queryRef);

  return internalQueryRef.promise.status === "fulfilled" ?
      internalQueryRef.promise
    : queryRef[PROMISE_SYMBOL];
}

export function unwrapQueryRef<TData>(
  queryRef: WrappedQueryRef<TData>
): InternalQueryReference<TData>;
export function unwrapQueryRef<TData>(
  queryRef: Partial<WrappedQueryRef<TData>>
): undefined | InternalQueryReference<TData>;
export function unwrapQueryRef<TData>(
  queryRef: Partial<WrappedQueryRef<TData>>
) {
  return queryRef[QUERY_REFERENCE_SYMBOL];
}

export function updateWrappedQueryRef<TData>(
  queryRef: WrappedQueryRef<TData>,
  promise: QueryRefPromise<TData>
) {
  queryRef[PROMISE_SYMBOL] = promise;
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
  (typeof OBSERVED_CHANGED_OPTIONS)[number]
>;

export class InternalQueryReference<TData = unknown> {
  public result!: ApolloQueryResult<TData>;
  public readonly key: QueryKey = {};
  public readonly observable: ObservableQuery<TData>;

  public promise!: QueryRefPromise<TData>;

  private subscription!: ObservableSubscription;
  private listeners = new Set<Listener<TData>>();
  private autoDisposeTimeoutId?: NodeJS.Timeout;

  private resolve: ((result: ApolloQueryResult<TData>) => void) | undefined;
  private reject: ((error: unknown) => void) | undefined;

  private references = 0;
  private softReferences = 0;

  constructor(
    observable: ObservableQuery<TData, any>,
    options: InternalQueryReferenceOptions
  ) {
    this.handleNext = this.handleNext.bind(this);
    this.handleError = this.handleError.bind(this);
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
        observable.silentSetOptions({ fetchPolicy: "standby" });
      } else {
        observable.resetLastResults();
        observable.silentSetOptions({ fetchPolicy: "cache-first" });
      }

      this.subscribeToQuery();

      if (avoidNetworkRequests) {
        return;
      }

      observable.resetDiff();
      this.setResult();
    } finally {
      observable.silentSetOptions({ fetchPolicy: originalFetchPolicy });
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
    switch (this.promise.status) {
      case "pending": {
        // Maintain the last successful `data` value if the next result does not
        // have one.
        if (result.data === void 0) {
          result.data = this.result.data;
        }
        this.result = result;
        this.resolve?.(result);
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

        this.result = result;
        this.promise = createFulfilledPromise(result);
        this.deliver(this.promise);
        break;
      }
    }
  }

  private handleError(error: ApolloError) {
    this.subscription.unsubscribe();
    this.subscription = this.observable.resubscribeAfterError(
      this.handleNext,
      this.handleError
    );

    switch (this.promise.status) {
      case "pending": {
        this.reject?.(error);
        break;
      }
      default: {
        this.promise = createRejectedPromise<ApolloQueryResult<TData>>(error);
        this.deliver(this.promise);
      }
    }
  }

  private deliver(promise: QueryRefPromise<TData>) {
    this.listeners.forEach((listener) => listener(promise));
  }

  private initiateFetch(returnedPromise: Promise<ApolloQueryResult<TData>>) {
    this.promise = this.createPendingPromise();
    this.promise.catch(() => {});

    // If the data returned from the fetch is deeply equal to the data already
    // in the cache, `handleNext` will not be triggered leaving the promise we
    // created in a pending state forever. To avoid this situtation, we attempt
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
            this.result = this.observable.getCurrentResult();
            this.resolve?.(this.result);
          }
        });
      })
      .catch(() => {});

    return returnedPromise;
  }

  private subscribeToQuery() {
    this.subscription = this.observable
      .filter(
        (result) => !equal(result.data, {}) && !equal(result, this.result)
      )
      .subscribe(this.handleNext, this.handleError);
  }

  private setResult() {
    // Don't save this result as last result to prevent delivery of last result
    // when first subscribing
    const result = this.observable.getCurrentResult(false);

    if (equal(result, this.result)) {
      return;
    }

    this.result = result;
    this.promise =
      (
        result.data &&
        (!result.partial || this.watchQueryOptions.returnPartialData)
      ) ?
        createFulfilledPromise(result)
      : this.createPendingPromise();
  }

  private createPendingPromise() {
    return wrapPromiseWithState(
      new Promise<ApolloQueryResult<TData>>((resolve, reject) => {
        this.resolve = resolve;
        this.reject = reject;
      })
    );
  }
}
