// This simplified polyfill attempts to follow the ECMAScript Observable proposal.
// See https://github.com/zenparsing/es-observable

import * as $$observable from 'symbol-observable';

import {
  FragmentDefinition,
} from 'graphql';

export type CleanupFunction = () => void;
export type SubscriberFunction<T> = (observer: Observer<T>) => (Subscription | CleanupFunction);

function isSubscription(subscription: Function | Subscription): subscription is Subscription {
  return (<Subscription>subscription).unsubscribe !== undefined;
}

export interface WatchQueryOptions {
  query: Document;
  variables?: { [key: string]: any };
  forceFetch?: boolean;
  returnPartialData?: boolean;
  noFetch?: boolean;
  pollInterval?: number;
  fragments?: FragmentDefinition[];
}


export class Observable<T> {
  private subscriberFunction: SubscriberFunction<T>;

  constructor(subscriberFunction: SubscriberFunction<T>) {
    this.subscriberFunction = subscriberFunction;
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
