import type {
  WatchFragmentOptions,
  WatchFragmentResult,
} from "../../../cache/index.js";
import type { ApolloClient } from "../../../core/ApolloClient.js";
import type { MaybeMasked } from "../../../masking/index.js";
import {
  createFulfilledPromise,
  wrapPromiseWithState,
} from "../../../utilities/index.js";
import type {
  Observable,
  ObservableSubscription,
  PromiseWithState,
} from "../../../utilities/index.js";
import type { FragmentKey } from "./types.js";

type FragmentRefPromise<TData> = PromiseWithState<TData>;
type Listener<TData> = (promise: FragmentRefPromise<TData>) => void;

interface FragmentReferenceOptions {
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

  private references = 0;

  constructor(
    client: ApolloClient<any>,
    watchFragmentOptions: WatchFragmentOptions<TData, TVariables>,
    options: FragmentReferenceOptions
  ) {
    this.dispose = this.dispose.bind(this);
    this.handleNext = this.handleNext.bind(this);
    this.handleError = this.handleError.bind(this);

    this.observable = client.watchFragment(watchFragmentOptions);

    if (options.onDispose) {
      this.onDispose = options.onDispose;
    }

    this.promise = this.createPendingPromise();
    this.subscribeToFragment();
  }

  listen(listener: Listener<MaybeMasked<TData>>) {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  retain() {
    this.references++;
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
}
