import {
  GraphQLResult,
} from 'graphql';

import {
  pull,
} from 'lodash';

import {
  Observable,
  Observer,
  Subscription,
} from './observable';

import {
  SelectionSetWithRoot,
} from './store';

import {
  QueryManager,
  WatchQueryOptions,
} from '../QueryManager';

export type QueryObserver = Observer<GraphQLResult>;

export default class ObservableQuery implements Observable<GraphQLResult> {
  public queryManager: QueryManager;
  public queryId: string;
  public selectionSetWithRoot: SelectionSetWithRoot;
  public options: WatchQueryOptions;
  public isLoading: boolean = true;
  public lastResult: GraphQLResult;

  private observers: QueryObserver[];

  constructor(queryManager: QueryManager, queryId: string, options: WatchQueryOptions) {
    this.queryManager = queryManager;
    this.queryId = queryId;
    this.options = options;
    this.observers = [];
  }

  public subscribe(observer: QueryObserver): Subscription {
    this.observers.push(observer);

    if (this.observers.length === 1) {
      this.queryManager.registerObservedQuery(this);
    }

    /// XXX Don't refetch for every new subscriber
    this.refetch();

    return {
      unsubscribe: () => {
        pull(this.observers, observer);

        if (this.observers.length < 1) {
          this.queryManager.deregisterObservedQuery(this);
        }
      },
    };
  }

  public result(): Promise<GraphQLResult> {
    return new Promise((resolve, reject) => {
      const subscription = this.subscribe({
        next(result) {
          resolve(result);
          setTimeout(() => {
            subscription.unsubscribe();
          }, 0);
        },
        error(error) {
          reject(error);
        },
      });
    });
  }

  public refetch() {
    this.queryManager.fetchQuery(this);
  }

  public didReceiveResult(result: GraphQLResult) {
    this.observers.forEach((observer) => {
      observer.next(result);
    });
  }

  public didReceiveError(error: Error) {
    this.observers.forEach((observer) => {
      observer.error(error);
    });
  }
}
