import { Observable, Observer, ObservableSubscription } from './Observable';

// A Concast observable concatenates the given sources into a single
// non-overlapping sequence, and broadcasts the elements of that sequence
// to any number of subscribers. Even though any number of observers can
// subscribe to the Concast, the source observables are guaranteed to
// receive at most one subscription each. In addition to broadcasting
// every next/error message to this.observers, the Concast stores the most
// recent message using this.latest, so any new observers can immediately
// obtain the most recent message, even if it was originally delivered in
// the past. This behavior means we can assume every active observer in
// this.observers has received the same most recent message.
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
  private sources: Iterator<Observable<T>>;

  constructor(sources: Iterable<Observable<T>>) {
    super(observer => {
      this.addObserver(observer);
      return () => this.removeObserver(observer);
    });

    // Since sources is required only to be iterable, the source
    // observables could in principle be generated lazily, and the
    // sequence could be infinite. In practice, sources is most often a
    // finite array of observables.
    this.sources = sources[Symbol.iterator]();

    // Suppress rejection warnings for this.promise, since it's perfectly
    // acceptable to pay no attention to this.promise if you're consuming
    // the results through the normal observable API.
    this.promise.catch(ignored => {});

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
        const method = observer[this.latest[0]];
        if (method) {
          method.call(observer, this.latest[1]);
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
  private latest?: ["next" | "error" | "complete", any?];

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
        const { done, value } = this.sources.next();
        if (done) {
          this.sub = null;
          if (this.latest &&
              this.latest[0] === "next") {
            this.resolve(this.latest[1]);
          } else {
            this.resolve();
          }
          this.latest = ["complete"];
          iterateObserversSafely(this.observers, "complete");
        } else {
          this.sub = value.subscribe(this.handlers);
        }
      }
    },
  };

  cleanup(callback: () => any) {
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
