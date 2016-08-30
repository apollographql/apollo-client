// This simplified polyfill attempts to follow the ECMAScript Observable proposal.
// See https://github.com/zenparsing/es-observable

import * as $$observable from 'symbol-observable';

export type CleanupFunction = () => void;
export type SubscriberFunction<T> = (observer: Observer<T>) => (Subscription | CleanupFunction);

const observableValue = $$observable;

function isSubscription(subscription: Function | Subscription): subscription is Subscription {
  return (<Subscription>subscription).unsubscribe !== undefined;
}

export class Observable<T> {
  private subscriberFunction: SubscriberFunction<T>;

  constructor(subscriberFunction: SubscriberFunction<T>) {
    this.subscriberFunction = subscriberFunction;
  }

  public [observableValue as symbol]() {
    return this;
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
