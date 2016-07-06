// This simplified polyfill attempts to follow the ECMAScript Observable proposal.
// See https://github.com/zenparsing/es-observable

import * as $$observable from 'symbol-observable';
import { GraphQLResult } from 'graphql';

export type CleanupFunction = () => void;
export type SubscriberFunction<T> = (observer: Observer<T>) => (Subscription | CleanupFunction);

function isSubscription(subscription: Function | Subscription): subscription is Subscription {
  return (<Subscription>subscription).unsubscribe !== undefined;
}

export class Observable<T> {
  public refetch: (variables?: any) => Promise<GraphQLResult>;
  public stopPolling: () => void;
  public startPolling: (p: number) => void;
  private subscriberFunction: SubscriberFunction<T>;

  constructor(subscriberFunction: SubscriberFunction<T>,
    refetch: (variables?: any) => Promise<GraphQLResult>,
    stopPolling: () => void, startPolling: (p: number) => void) {
    this.subscriberFunction = subscriberFunction;
    this.refetch = refetch;
    this.stopPolling = stopPolling;
    this.startPolling = startPolling;

  }

  public [$$observable]() {
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
