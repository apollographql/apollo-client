import { ZenObservable } from './types';

export { ZenObservable };

declare global {
  interface SymbolConstructor {
    observable: symbol;
  }
}

// === Abstract Operations ===
function cleanupSubscription(subscription: Subscription) {
  // Assert:  observer._observer is undefined

  let cleanup = subscription._cleanup;

  if (!cleanup) {
    return;
  }

  // Drop the reference to the cleanup function so that we won't call it
  // more than once
  subscription._cleanup = undefined;

  // Call the cleanup function
  cleanup();
}

function subscriptionClosed(subscription: Subscription) {
  return subscription._observer === undefined;
}

function closeSubscription(subscription: Subscription) {
  if (subscriptionClosed(subscription)) {
    return;
  }

  subscription._observer = undefined;
  cleanupSubscription(subscription);
}

function cleanupFromSubscription(subscription: ZenObservable.Subscription) {
  return () => {
    subscription.unsubscribe();
  };
}

class Subscription implements ZenObservable.Subscription {
  public _observer?: ZenObservable.Observer<any>;
  public _cleanup: () => void;

  constructor(
    observer: ZenObservable.Observer<any>,
    subscriber: ZenObservable.Subscriber<any>,
  ) {
    // Assert: subscriber is callable

    // The observer must be an object
    if (Object(observer) !== observer) {
      throw new TypeError('Observer must be an object');
    }

    this._cleanup = undefined;
    this._observer = observer;

    if (observer.start) {
      observer.start(this);
    }

    if (subscriptionClosed(this)) {
      return;
    }

    let _observer = new SubscriptionObserver(this);

    try {
      // Call the subscriber function
      let cleanup = subscriber(_observer);

      // The return value must be undefined, null, a subscription object, or a function
      if (cleanup != null) {
        if (
          typeof (<ZenObservable.Subscription>cleanup).unsubscribe ===
          'function'
        ) {
          cleanup = cleanupFromSubscription(
            cleanup as ZenObservable.Subscription,
          );
        } else if (typeof cleanup !== 'function') {
          throw new TypeError(cleanup + ' is not a function');
        }

        this._cleanup = cleanup;
      }
    } catch (e) {
      // If an error occurs during startup, then attempt to send the error
      // to the observer
      if (_observer.error) {
        _observer.error(e);
      }
      return;
    }
    // If the stream is already finished, then perform cleanup
    if (subscriptionClosed(this)) {
      cleanupSubscription(this);
    }
  }

  get closed() {
    return subscriptionClosed(this);
  }

  public unsubscribe() {
    closeSubscription(this);
  }
}

class SubscriptionObserver<T> implements ZenObservable.SubscriptionObserver<T> {
  private _subscription: Subscription;

  constructor(subscription: Subscription) {
    this._subscription = subscription;
  }

  get closed() {
    return subscriptionClosed(this._subscription);
  }

  public next(value: T) {
    let subscription = this._subscription;

    // If the stream is closed, then return undefined
    if (subscriptionClosed(subscription)) {
      return;
    }

    let observer = subscription._observer;

    // If the observer doesn't support "next", then return undefined
    if (!observer.next) {
      return;
    }

    // Send the next value to the sink
    observer.next(value);
    return;
  }

  public error(value: T) {
    let subscription = this._subscription;

    // If the stream is closed, throw the error to the caller
    if (subscriptionClosed(subscription)) {
      throw value;
    }

    let observer = subscription._observer;
    subscription._observer = undefined;

    try {
      // If the sink does not support "error", then throw the error to the caller
      if (!observer.error) {
        throw value;
      }

      observer.error(value);
    } catch (e) {
      try {
        cleanupSubscription(subscription);
      } finally {
        throw e;
      }
    }

    cleanupSubscription(subscription);
  }

  public complete() {
    let subscription = this._subscription;

    // If the stream is closed, then return undefined
    if (subscriptionClosed(subscription)) {
      return;
    }

    let observer = subscription._observer;
    subscription._observer = undefined;

    try {
      if (observer.complete) {
        observer.complete();
      }
    } catch (e) {
      try {
        cleanupSubscription(subscription);
      } finally {
        throw e;
      }
    }

    cleanupSubscription(subscription);
  }
}

export default class Observable<T> {
  private _subscriber: ZenObservable.Subscriber<T>;

  public static from<R>(
    observable: Observable<R> | ZenObservable.ObservableLike<R> | ArrayLike<R>,
  ): Observable<R> {
    if ((<ZenObservable.ObservableLike<R>>observable).subscribe) {
      return new Observable(observer =>
        (<ZenObservable.ObservableLike<R>>observable).subscribe(observer),
      );
    }

    if (Array.isArray(observable)) {
      return new Observable(observer => {
        for (let i = 0; i < observable.length; ++i) {
          observer.next(observable[i]);
          if (observer.closed) {
            return;
          }
        }

        if (observer.complete) {
          observer.complete();
        }
      });
    }

    throw new TypeError(observable + ' is not observable');
  }

  public static of<R>(...items: R[]): Observable<R> {
    return new Observable(observer => {
      for (let i = 0; i < items.length; ++i) {
        observer.next(items[i]);
        if (observer.closed) {
          return;
        }
      }

      if (observer.complete) {
        observer.complete();
      }
    });
  }

  constructor(subscriber: ZenObservable.Subscriber<T>) {
    // The stream subscriber must be a function
    if (typeof subscriber !== 'function') {
      throw new TypeError('Observable initializer must be a function');
    }

    this._subscriber = subscriber;
  }

  public subscribe(
    observerOrNext: ((value: T) => void) | ZenObservable.Observer<T>,
    error?: (error: any) => void,
    complete?: () => void,
  ): ZenObservable.Subscription {
    if (typeof observerOrNext === 'function') {
      return new Subscription(
        {
          next: observerOrNext,
          error,
          complete,
        },
        this._subscriber,
      );
    }

    return new Subscription(observerOrNext, this._subscriber);
  }

  public forEach(fn: (value: T) => void): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (typeof fn !== 'function') {
        return Promise.reject(new TypeError(fn + ' is not a function'));
      }

      this.subscribe(
        <ZenObservable.Observer<T>>{
          start(subscription: ZenObservable.Subscription) {
            this._subscription = subscription;
          },

          next(value: T) {
            let subscription = this._subscription;

            if (subscription.closed) {
              return;
            }

            try {
              fn(value);
              return;
            } catch (err) {
              reject(err);
              subscription.unsubscribe();
            }
          },

          error: reject,
          complete: resolve,
        },
      );
    });
  }

  public map<R>(fn: (value: T) => R): Observable<R> {
    if (typeof fn !== 'function') {
      throw new TypeError(fn + ' is not a function');
    }

    return new Observable(observer => {
      return this.subscribe({
        next(value: T) {
          if (observer.closed) {
            return;
          }

          let _value: R;
          try {
            _value = fn(value);
          } catch (e) {
            observer.error(e);
            return;
          }

          observer.next(_value);
        },
        error(e: any) {
          observer.error(e);
        },
        complete() {
          observer.complete();
        },
      });
    });
  }

  public filter(fn: (value: T) => boolean): Observable<T> {
    if (typeof fn !== 'function') {
      throw new TypeError(fn + ' is not a function');
    }

    return new Observable(observer => {
      this.subscribe({
        next(value: T) {
          if (observer.closed) {
            return;
          }

          try {
            if (!fn(value)) {
              return;
            }
          } catch (e) {
            if (observer.error) {
              observer.error(e);
            }
            return;
          }

          observer.next(value);
        },

        error(e: any) {
          observer.error(e);
        },
        complete() {
          observer.complete();
        },
      });
    });
  }

  public reduce<R = T>(
    fn: (previousValue: R | T, currentValue: T) => R | T,
    initialValue?: R | T,
  ): Observable<R | T> {
    if (typeof fn !== 'function') {
      throw new TypeError(fn + ' is not a function');
    }

    let hasSeed = arguments.length > 1;
    let hasValue = false;
    let seed = arguments[1];
    let acc = seed;

    return new Observable<R | T>(observer => {
      this.subscribe({
        next(value: R | T) {
          if (observer.closed) {
            return;
          }

          let first = !hasValue;
          hasValue = true;

          if (!first || hasSeed) {
            try {
              acc = fn(acc, <T>value);
            } catch (e) {
              observer.error(e);
              return;
            }
          } else {
            acc = value;
          }
        },

        error(e: any) {
          observer.error(e);
        },

        complete() {
          if (!hasValue && !hasSeed) {
            observer.error(new TypeError('Cannot reduce an empty sequence'));
            return;
          }

          observer.next(acc);
          observer.complete();
        },
      });
    });
  }

  public flatMap<R>(
    fn: (value: T) => ZenObservable.ObservableLike<R>,
  ): Observable<R> {
    if (typeof fn !== 'function') {
      throw new TypeError(fn + ' is not a function');
    }

    return new Observable(observer => {
      let completed = false;
      let subscriptions: Array<ZenObservable.Subscription> = [];

      // Subscribe to the outer Observable
      let outer = this.subscribe({
        next(value: T) {
          let _value: ZenObservable.ObservableLike<R>;
          if (fn) {
            try {
              _value = fn(value);
            } catch (x) {
              observer.error(x);
              return;
            }
          }

          // Subscribe to the inner Observable
          Observable.from(_value).subscribe({
            start(s: ZenObservable.Subscription) {
              subscriptions.push((this._subscription = s));
            },
            next(data: R) {
              observer.next(data);
            },
            error(e) {
              observer.error(e);
            },

            complete() {
              let i = subscriptions.indexOf(this._subscription);

              if (i >= 0) {
                subscriptions.splice(i, 1);
              }

              closeIfDone();
            },
          });
        },

        error(e) {
          observer.error(e);
        },

        complete() {
          completed = true;
          closeIfDone();
        },
      });

      function closeIfDone() {
        if (completed && subscriptions.length === 0) {
          observer.complete();
        }
      }

      return () => {
        subscriptions.forEach(s => s.unsubscribe());
        outer.unsubscribe();
      };
    });
  }

  public [Symbol.observable]() {
    return <Observable<T>>this;
    // writable: true,
    // configurable: true,
  }
  // [Symbol.species](){
  //   return <Observable<T>>this;
  //   //configurable: true,
  // }
}
