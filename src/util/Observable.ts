// This simplified polyfill attempts to follow the ECMAScript Observable proposal.
// See https://github.com/zenparsing/es-observable

import * as $$observable from 'symbol-observable';

import {
  QueryManager,
  WatchQueryOptions,
} from '../QueryManager';

export type CleanupFunction = () => void;
export type SubscriberFunction<T> = (observer: Observer<T>) => (Subscription | CleanupFunction);

export class Observable<T> {
  public queryManager: QueryManager;
  public options: WatchQueryOptions;

  constructor(queryManager: QueryManager, options: WatchQueryOptions) {
    this.options = options;
    this.queryManager = queryManager;
  }

  public [$$observable]() {
    return this;
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
