import type {
  Observer,
  ObservableSubscription,
  Subscriber,
} from "./Observable.js";
import { Observable } from "./Observable.js";
import { iterateObserversSafely } from "./iteration.js";
import { fixObservableSubclass } from "./subclassing.js";

type MaybeAsync<T> = T | PromiseLike<T>;

function isPromiseLike<T>(value: MaybeAsync<T>): value is PromiseLike<T> {
  return value && typeof (value as any).then === "function";
}

// Any individual Source<T> can be an Observable<T> or a promise for one.
type Source<T> = MaybeAsync<Observable<T>>;

export type ConcastSourcesIterable<T> = Iterable<Source<T>>;
export type ConcastSourcesArray<T> = Array<Source<T>>;

// A Concast<T> observable concatenates the given sources into a single
// non-overlapping sequence of Ts, automatically unwrapping any promises,
// and broadcasts the T elements of that sequence to any number of
// subscribers, all without creating a bunch of intermediary Observable
// wrapper objects.
//
// Even though any number of observers can subscribe to the Concast, each
// source observable is guaranteed to receive at most one subscribe call,
// and the results are multicast to all observers.
//
// In addition to broadcasting every next/error message to this.observers,
// the Concast stores the most recent message using this.latest, so any
// new observers can immediately receive the latest message, even if it
// was originally delivered in the past. This behavior means we can assume
// every active observer in this.observers has received the same most
// recent message.
//
// With the exception of this.latest replay, a Concast is a "hot"
// observable in the sense that it does not replay past results from the
// beginning of time for each new observer.
//
// Could we have used some existing RxJS class instead? Concast<T> is
// similar to a BehaviorSubject<T>, because it is multicast and redelivers
// the latest next/error message to new subscribers. Unlike Subject<T>,
// Concast<T> does not expose an Observer<T> interface (this.handlers is
// intentionally private), since Concast<T> gets its inputs from the
// concatenated sources. If we ever switch to RxJS, there may be some
// value in reusing their code, but for now we use zen-observable, which
// does not contain any Subject implementations.
export class Concast<T> extends Observable<T> {
  // Active observers receiving broadcast messages. Thanks to this.latest,
  // we can assume all observers in this Set have received the same most
  // recent message, though possibly at different times in the past.
  private observers = new Set<Observer<T>>();

  // This property starts off undefined to indicate the initial
  // subscription has not yet begun, then points to each source
  // subscription in turn, and finally becomes null after the sources have
  // been exhausted. After that, it stays null.
  private sub?: ObservableSubscription | null;

  // Not only can the individual elements of the iterable be promises, but
  // also the iterable itself can be wrapped in a promise.
  constructor(sources: MaybeAsync<ConcastSourcesIterable<T>> | Subscriber<T>) {
    super((observer) => {
      this.addObserver(observer);
      return () => this.removeObserver(observer);
    });

    // Suppress rejection warnings for this.promise, since it's perfectly
    // acceptable to pay no attention to this.promise if you're consuming
    // the results through the normal observable API.
    this.promise.catch((_) => {});

    // If someone accidentally tries to create a Concast using a subscriber
    // function, recover by creating an Observable from that subscriber and
    // using it as the source.
    if (typeof sources === "function") {
      sources = [new Observable(sources)];
    }

    if (isPromiseLike(sources)) {
      sources.then((iterable) => this.start(iterable), this.handlers.error);
    } else {
      this.start(sources);
    }
  }

  // A consumable array of source observables, incrementally consumed each time
  // this.handlers.complete is called. This private field is not initialized
  // until the concast.start method is called, which can happen asynchronously
  // if a Promise is passed to the Concast constructor, so undefined is a
  // possible value for this.sources before concast.start is called.
  private sources: Source<T>[] | undefined;

  private start(sources: ConcastSourcesIterable<T>) {
    if (this.sub !== void 0) return;

    // In practice, sources is most often simply an Array of observables.
    // TODO Consider using sources[Symbol.iterator]() to take advantage
    // of the laziness of non-Array iterables.
    this.sources = Array.from(sources);

    // Calling this.handlers.complete() kicks off consumption of the first
    // source observable. It's tempting to do this step lazily in
    // addObserver, but this.promise can be accessed without calling
    // addObserver, so consumption needs to begin eagerly.
    this.handlers.complete();
  }

  private deliverLastMessage(observer: Observer<T>) {
    if (this.latest) {
      const nextOrError = this.latest[0];
      const method = observer[nextOrError];
      if (method) {
        method.call(observer, this.latest[1]);
      }
      // If the subscription is already closed, and the last message was
      // a 'next' message, simulate delivery of the final 'complete'
      // message again.
      if (this.sub === null && nextOrError === "next" && observer.complete) {
        observer.complete();
      }
    }
  }

  public addObserver(observer: Observer<T>) {
    if (!this.observers.has(observer)) {
      // Immediately deliver the most recent message, so we can always
      // be sure all observers have the latest information.
      this.deliverLastMessage(observer);
      this.observers.add(observer);
    }
  }

  public removeObserver(observer: Observer<T>) {
    if (this.observers.delete(observer) && this.observers.size < 1) {
      // In case there are still any listeners in this.nextResultListeners, and
      // no error or completion has been broadcast yet, make sure those
      // observers have a chance to run and then remove themselves from
      // this.observers.
      this.handlers.complete();
    }
  }

  // Any Concast object can be trivially converted to a Promise, without
  // having to create a new wrapper Observable. This promise provides an
  // easy way to observe the final state of the Concast.
  private resolve!: (result?: T | PromiseLike<T>) => void;
  private reject!: (reason: any) => void;
  public readonly promise = new Promise<T | undefined>((resolve, reject) => {
    this.resolve = resolve;
    this.reject = reject;
  });

  // Name and argument of the most recently invoked observer method, used
  // to deliver latest results immediately to new observers.
  private latest?: ["next", T] | ["error", any];

  // Bound handler functions that can be reused for every internal
  // subscription.
  private handlers = {
    next: (result: T) => {
      if (this.sub !== null) {
        this.latest = ["next", result];
        this.notify("next", result);
        iterateObserversSafely(this.observers, "next", result);
      }
    },

    error: (error: any) => {
      const { sub } = this;
      if (sub !== null) {
        // Delay unsubscribing from the underlying subscription slightly,
        // so that immediately subscribing another observer can keep the
        // subscription active.
        if (sub) setTimeout(() => sub.unsubscribe());
        this.sub = null;
        this.latest = ["error", error];
        this.reject(error);
        this.notify("error", error);
        iterateObserversSafely(this.observers, "error", error);
      }
    },

    complete: () => {
      const { sub, sources = [] } = this;
      if (sub !== null) {
        // If complete is called before concast.start, this.sources may be
        // undefined, so we use a default value of [] for sources. That works
        // here because it falls into the if (!value) {...} block, which
        // appropriately terminates the Concast, even if this.sources might
        // eventually have been initialized to a non-empty array.
        const value = sources.shift();
        if (!value) {
          if (sub) setTimeout(() => sub.unsubscribe());
          this.sub = null;
          if (this.latest && this.latest[0] === "next") {
            this.resolve(this.latest[1]);
          } else {
            this.resolve();
          }
          this.notify("complete");
          // We do not store this.latest = ["complete"], because doing so
          // discards useful information about the previous next (or
          // error) message. Instead, if new observers subscribe after
          // this Concast has completed, they will receive the final
          // 'next' message (unless there was an error) immediately
          // followed by a 'complete' message (see addObserver).
          iterateObserversSafely(this.observers, "complete");
        } else if (isPromiseLike(value)) {
          value.then(
            (obs) => (this.sub = obs.subscribe(this.handlers)),
            this.handlers.error
          );
        } else {
          this.sub = value.subscribe(this.handlers);
        }
      }
    },
  };

  private nextResultListeners = new Set<NextResultListener>();

  private notify(
    method: Parameters<NextResultListener>[0],
    arg?: Parameters<NextResultListener>[1]
  ) {
    const { nextResultListeners } = this;
    if (nextResultListeners.size) {
      // Replacing this.nextResultListeners first ensures it does not grow while
      // we are iterating over it, potentially leading to infinite loops.
      this.nextResultListeners = new Set();
      nextResultListeners.forEach((listener) => listener(method, arg));
    }
  }

  // We need a way to run callbacks just *before* the next result (or error or
  // completion) is delivered by this Concast, so we can be sure any code that
  // runs as a result of delivering that result/error observes the effects of
  // running the callback(s). It was tempting to reuse the Observer type instead
  // of introducing NextResultListener, but that messes with the sizing and
  // maintenance of this.observers, and ends up being more code overall.
  beforeNext(callback: NextResultListener) {
    let called = false;
    this.nextResultListeners.add((method, arg) => {
      if (!called) {
        called = true;
        callback(method, arg);
      }
    });
  }

  // A public way to abort observation and broadcast.
  public cancel = (reason: any) => {
    this.reject(reason);
    this.sources = [];
    this.handlers.complete();
  };
}

type NextResultListener = (
  method: "next" | "error" | "complete",
  arg?: any
) => any;

// Necessary because the Concast constructor has a different signature
// than the Observable constructor.
fixObservableSubclass(Concast);
