import type { WatchFragmentResult } from "../../../cache/index.js";
import { wrapPromiseWithState } from "../../../utilities/index.js";
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

export class FragmentReference<TData = unknown> {
  public readonly observable: Observable<WatchFragmentResult<TData>>;
  public readonly key: FragmentKey = {};
  public promise!: FragmentRefPromise<TData>;

  private resolve: ((result: TData) => void) | undefined;
  private reject: ((error: unknown) => void) | undefined;

  private subscription!: ObservableSubscription;
  private listeners = new Set<Listener<TData>>();

  private references = 0;

  constructor(
    observable: Observable<WatchFragmentResult<TData>>,
    options: FragmentReferenceOptions
  ) {
    this.dispose = this.dispose.bind(this);
    this.handleNext = this.handleNext.bind(this);
    this.handleError = this.handleError.bind(this);

    this.observable = observable;

    if (options.onDispose) {
      this.onDispose = options.onDispose;
    }

    this.promise = wrapPromiseWithState(
      new Promise((resolve, reject) => {
        this.resolve = resolve;
        this.reject = reject;
      })
    );

    this.subscribeToFragment();
  }

  listen(listener: Listener<TData>) {
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
          this.resolve?.(result.data);
        }

        break;
      }
    }
  }

  private handleError(error: unknown) {
    this.reject?.(error);
  }

  private deliver(promise: FragmentRefPromise<TData>) {
    this.listeners.forEach((listener) => listener(promise));
  }
}
