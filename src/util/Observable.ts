// This simplified polyfill attempts to follow the ECMAScript Observable proposal.
// See https://github.com/zenparsing/es-observable

import $$observable from 'symbol-observable';

export type CleanupFunction = () => void;
export type SubscriberFunction<T> = (observer: Observer<T>) => (Subscription | CleanupFunction);

function isSubscription(subscription: Function | Subscription): subscription is Subscription {
  return (<Subscription>subscription).unsubscribe !== undefined;
}

export class Observable<T> {
  private subscriberFunction: SubscriberFunction<T>;

  constructor(subscriberFunction: SubscriberFunction<T>) {
    this.subscriberFunction = subscriberFunction;
  }

  public [$$observable]() {
    return this;
  }

  public map<R>(mapFn: (v:T) => R): Observable<R> {
    return new Observable((observer) => {
      return this.subscribe({
        next: (v) => {
          try {
            observer.next && observer.next(mapFn(v));
          } catch (e) {
            observer.error && observer.error(e);
          }
        },
        error: observer.error && observer.error.bind(observer),
        complete: observer.complete && observer.complete.bind(observer),
      });
    });
  }

  public filter(filterFn: (v:T) => boolean): Observable<T> {
    return new Observable((observer) => {
      return this.subscribe({
        next: (v) => filterFn(v) && observer.next && observer.next(v),
        error: observer.error && observer.error.bind(observer),
        complete: observer.complete && observer.complete.bind(observer),
      });
    });
  }

  public switchMap<R>(mapFn: (v:T) => Observable<R>): Observable<R> {
    return new Observable((observer) => {
      let lastSubscription: Subscription | undefined;
      let trunkSubscription = this.subscribe({
        next: (v) => {
          if ( lastSubscription ) {
            lastSubscription.unsubscribe();
          }

          lastSubscription = mapFn(v).subscribe(observer);
        },
        error: observer.error && observer.error.bind(observer),
        complete: observer.complete && observer.complete.bind(observer),
      });

      return () => {
        if ( lastSubscription ) {
          lastSubscription.unsubscribe();
          lastSubscription = undefined;
        }

        if ( trunkSubscription ) {
          trunkSubscription.unsubscribe();
        }
      }
    });
  }

  public subscribe(observer: Observer<T>): Subscription {
    let subscriptionOrCleanupFunction = this.subscriberFunction(observer);

    if (isSubscription(subscriptionOrCleanupFunction)) {
      return subscriptionOrCleanupFunction;
    } else {
      return {
        unsubscribe: subscriptionOrCleanupFunction,
      };
    }
  }
}

export interface Observer<T> {
  next?: (value: T) => void;
  error?: (error: Error) => void;
  complete?: () => void;
}

export interface Subscription {
  unsubscribe: CleanupFunction;
}
