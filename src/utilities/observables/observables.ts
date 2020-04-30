import { Observable, Observer, ObservableSubscription } from './Observable';

type MaybeAsync<T> = T | PromiseLike<T>;

function isPromiseLike<T>(value: MaybeAsync<T>): value is PromiseLike<T> {
  return value && typeof (value as any).then === "function";
}

// Any individual Source<T> can be an Observable<T> or a promise for one.
type Source<T> = MaybeAsync<Observable<T>>;

export type ConcastSourcesIterable<T> = Iterable<Source<T>>;

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

  // A consumable iterator of source observables, incrementally consumed
  // each time this.handlers.complete is called.
  private sources: Iterator<Source<T>>;

  // Not only can the individual elements of the iterable be promises, but
  // also the iterable itself can be wrapped in a promise.
  constructor(sources: MaybeAsync<ConcastSourcesIterable<T>>) {
    super(observer => {
      this.addObserver(observer);
      return () => this.removeObserver(observer);
    });

    // Suppress rejection warnings for this.promise, since it's perfectly
    // acceptable to pay no attention to this.promise if you're consuming
    // the results through the normal observable API.
    this.promise.catch(_ => {});

    if (isPromiseLike(sources)) {
      sources.then(
        iterable => this.start(iterable),
        this.handlers.error,
      );
    } else {
      this.start(sources);
    }
  }

  private start(sources: ConcastSourcesIterable<T>) {
    if (this.sub !== void 0) return;

    // Since sources is required only to be iterable, the source
    // observables could in principle be generated lazily, and the
    // sequence could be infinite. In practice, sources is most often a
    // finite array of observables.
    this.sources = sources[Symbol.iterator]();

    // Calling this.handlers.complete() kicks off consumption of the first
    // source observable. It's tempting to do this step lazily in
    // addObserver, but this.promise can be accessed without calling
    // addObserver, so consumption needs to begin eagerly.
    this.handlers.complete!();
  }

  // Generic implementations of Observable.prototype methods like map and
  // filter need to know how to create a new Observable from a Concast.
  // Those methods assume (perhaps unwisely?) that they can call the
  // subtype's constructor with an observer registration function, but the
  // Concast constructor uses a different signature. Defining this
  // Symbol.species getter function on the Concast constructor function is
  // a hint to generic Observable code to use the default constructor
  // instead of trying to do `new Concast(observer => ...)`.
  static get [Symbol.species]() {
    return Observable;
  }

  private addObserver(observer: Observer<T>) {
    if (!this.observers.has(observer)) {
      // Immediately deliver the most recent message, so we can always
      // be sure all observers have the latest information.
      if (this.latest) {
        const nextOrError = this.latest[0];
        const method = observer[nextOrError];
        if (method) {
          method.call(observer, this.latest[1]);
        }
        // If the subscription is already closed, and the last message was
        // a 'next' message, simulate delivery of the final 'complete'
        // message again.
        if (this.sub === null &&
            nextOrError === "next" &&
            observer.complete) {
          observer.complete();
        }
      }
      this.observers.add(observer);
    }
  }

  private removeObserver(observer: Observer<T>) {
    if (this.observers.delete(observer) &&
        this.observers.size < 1) {
      if (this.sub) {
        this.sub.unsubscribe();
        // In case anyone happens to be listening to this.promise, after
        // this.observers has become empty.
        this.reject(new Error("Observable cancelled prematurely"));
      }
      this.sub = null;
    }
  }

  // Any Concast object can be trivially converted to a Promise, without
  // having to create a new wrapper Observable. This promise provides an
  // easy way to observe the final state of the Concast.
  private resolve: (result?: T) => void;
  private reject: (reason: any) => void;
  public readonly promise = new Promise<T>((resolve, reject) => {
    this.resolve = resolve;
    this.reject = reject;
  });

  // Name and argument of the most recently invoked observer method, used
  // to deliver latest results immediately to new observers.
  private latest?: ["next" | "error", any];

  // Bound handler functions that can be reused for every internal
  // subscription.
  private handlers: Observer<T> = {
    next: result => {
      if (this.sub !== null) {
        this.latest = ["next", result];
        iterateObserversSafely(this.observers, "next", result);
      }
    },

    error: error => {
      if (this.sub !== null) {
        if (this.sub) this.sub.unsubscribe();
        this.sub = null;
        this.latest = ["error", error];
        this.reject(error);
        iterateObserversSafely(this.observers, "error", error);
      }
    },

    complete: () => {
      if (this.sub !== null) {
        const { done, value } = this.sources.next() as {
          done: boolean;
          value: Source<T>;
        };

        if (done) {
          this.sub = null;
          if (this.latest &&
              this.latest[0] === "next") {
            this.resolve(this.latest[1]);
          } else {
            this.resolve();
          }
          // We do not store this.latest = ["complete"], because doing so
          // discards useful information about the previous next (or
          // error) message. Instead, if new observers subscribe after
          // this Concast has completed, they will receive the final
          // 'next' message (unless there was an error) immediately
          // followed by a 'complete' message (see addObserver).
          iterateObserversSafely(this.observers, "complete");
        } else if (isPromiseLike(value)) {
          value.then(obs => this.sub = obs.subscribe(this.handlers));
        } else {
          this.sub = value.subscribe(this.handlers);
        }
      }
    },
  };

  public cleanup(callback: () => any) {
    let called = false;
    const once = () => {
      if (!called) {
        called = true;
        this.observers.delete(observer);
        callback();
      }
    }
    const observer = {
      next: once,
      error: once,
      complete: once,
    };
    this.addObserver(observer);
  }

  // A public way to abort observation and broadcast.
  public cancel = (reason: any) => {
    this.reject(reason);
    this.sources = emptyIter;
    this.handlers.complete!();
  }
}

const emptyIter: Iterator<any> = {
  next() {
    return { value: void 0, done: true };
  },
};

export function multicast<T>(...sources: Observable<T>[]) {
  return new Concast(sources);
}

// Like Observable.prototype.map, except that the mapping function can
// optionally return a Promise (or be async).
export function asyncMap<V, R>(
  observable: Observable<V>,
  mapFn: (value: V) => R | PromiseLike<R>,
  catchFn?: (error: any) => R | PromiseLike<R>,
): Observable<R> {
  return new Observable<R>(observer => {
    const { next, error, complete } = observer;
    let activeCallbackCount = 0;
    let completed = false;

    function makeCallback(
      examiner: typeof mapFn | typeof catchFn,
      delegate: typeof next | typeof error,
    ): (arg: any) => void {
      if (examiner) {
        return arg => {
          ++activeCallbackCount;
          new Promise(resolve => resolve(examiner(arg))).then(
            result => {
              --activeCallbackCount;
              next && next.call(observer, result);
              if (completed) {
                handler.complete!();
              }
            },
            e => {
              --activeCallbackCount;
              error && error.call(observer, e);
            },
          );
        };
      } else {
        return arg => delegate && delegate.call(observer, arg);
      }
    }

    const handler: Observer<V> = {
      next: makeCallback(mapFn, next),
      error: makeCallback(catchFn, error),
      complete() {
        completed = true;
        if (!activeCallbackCount) {
          complete && complete.call(observer);
        }
      },
    };

    const sub = observable.subscribe(handler);
    return () => sub.unsubscribe();
  });
}

export function iterateObserversSafely<E, A>(
  observers: Set<Observer<E>>,
  method: keyof Observer<E>,
  argument?: A,
) {
  // In case observers is modified during iteration, we need to commit to the
  // original elements, which also provides an opportunity to filter them down
  // to just the observers with the given method.
  const observersWithMethod: Observer<E>[] = [];
  observers.forEach(obs => obs[method] && observersWithMethod.push(obs));
  observersWithMethod.forEach(obs => (obs as any)[method](argument));
}
