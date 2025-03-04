import { equal } from "@wry/equality";
import type {
  WatchFragmentOptions,
  WatchFragmentResult,
} from "@apollo/client/cache";
import type { ApolloClient } from "../../../core/ApolloClient.js";
import type { MaybeMasked } from "@apollo/client/masking";
import {
  createFulfilledPromise,
  wrapPromiseWithState,
} from "@apollo/client/utilities";
import type {
  Observable,
  ObservableSubscription,
  PromiseWithState,
} from "@apollo/client/utilities";
import type { FragmentKey } from "./types.js";

type FragmentRefPromise<TData> = PromiseWithState<TData>;
type Listener<TData> = (promise: FragmentRefPromise<TData>) => void;

interface FragmentReferenceOptions {
  autoDisposeTimeoutMs?: number;
  onDispose?: () => void;
}

export class FragmentReference<
  TData = unknown,
  TVariables = Record<string, unknown>,
> {
  public readonly observable: Observable<WatchFragmentResult<TData>>;
  public readonly key: FragmentKey = {};
  public promise!: FragmentRefPromise<MaybeMasked<TData>>;

  private resolve: ((result: MaybeMasked<TData>) => void) | undefined;
  private reject: ((error: unknown) => void) | undefined;

  private subscription!: ObservableSubscription;
  private listeners = new Set<Listener<MaybeMasked<TData>>>();
  private autoDisposeTimeoutId?: NodeJS.Timeout;

  private references = 0;

  constructor(
    client: ApolloClient<any>,
    watchFragmentOptions: WatchFragmentOptions<TData, TVariables> & {
      from: string;
    },
    options: FragmentReferenceOptions
  ) {
    this.dispose = this.dispose.bind(this);
    this.handleNext = this.handleNext.bind(this);
    this.handleError = this.handleError.bind(this);

    this.observable = client.watchFragment(watchFragmentOptions);

    if (options.onDispose) {
      this.onDispose = options.onDispose;
    }

    const diff = this.getDiff(client, watchFragmentOptions);

    // Start a timer that will automatically dispose of the query if the
    // suspended resource does not use this fragmentRef in the given time. This
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

    this.promise =
      diff.complete ?
        createFulfilledPromise(diff.result)
      : this.createPendingPromise();
    this.subscribeToFragment();

    this.promise.then(startDisposeTimer, startDisposeTimer);
  }

  listen(listener: Listener<MaybeMasked<TData>>) {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
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

  private dispose() {
    this.subscription.unsubscribe();
    this.onDispose();
  }

  private onDispose() {
    // noop. overridable by options
  }

  private subscribeToFragment() {
    this.subscription = this.observable.subscribe(
      this.handleNext.bind(this),
      this.handleError.bind(this)
    );
  }

  private handleNext(result: WatchFragmentResult<TData>) {
    switch (this.promise.status) {
      case "pending": {
        if (result.complete) {
          return this.resolve?.(result.data);
        }

        this.deliver(this.promise);
        break;
      }
      case "fulfilled": {
        // This can occur when we already have a result written to the cache and
        // we subscribe for the first time. We create a fulfilled promise in the
        // constructor with a value that is the same as the first emitted value
        // so we want to skip delivering it.
        if (equal(this.promise.value, result.data)) {
          return;
        }

        this.promise =
          result.complete ?
            createFulfilledPromise(result.data)
          : this.createPendingPromise();

        this.deliver(this.promise);
      }
    }
  }

  private handleError(error: unknown) {
    this.reject?.(error);
  }

  private deliver(promise: FragmentRefPromise<MaybeMasked<TData>>) {
    this.listeners.forEach((listener) => listener(promise));
  }

  private createPendingPromise() {
    return wrapPromiseWithState(
      new Promise<MaybeMasked<TData>>((resolve, reject) => {
        this.resolve = resolve;
        this.reject = reject;
      })
    );
  }

  private getDiff<TData, TVariables>(
    client: ApolloClient<any>,
    options: WatchFragmentOptions<TData, TVariables> & { from: string }
  ) {
    const { cache } = client;
    const { from, fragment, fragmentName } = options;

    const diff = cache.diff({
      ...options,
      query: cache["getFragmentDoc"](fragment, fragmentName),
      returnPartialData: true,
      id: from,
      optimistic: true,
    });

    return {
      ...diff,
      result: client["queryManager"].maskFragment({
        fragment,
        fragmentName,
        data: diff.result,
      }) as MaybeMasked<TData>,
    };
  }
}
