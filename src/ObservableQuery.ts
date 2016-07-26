import { WatchQueryOptions } from './watchQueryOptions';

import { Observable, Observer } from './util/Observable';

import {
  QueryScheduler,
} from './scheduler';

import {
  QueryManager,
} from './QueryManager';

import {
  ApolloQueryResult,
} from './index';

import assign = require('lodash.assign');

export class ObservableQuery extends Observable<ApolloQueryResult> {
  public refetch: (variables?: any) => Promise<ApolloQueryResult>;
  public fetchMore: (fetchMoreLocations: string[], variables?: any) => Promise<ApolloQueryResult>;
  public stopPolling: () => void;
  public startPolling: (p: number) => void;
  public options: WatchQueryOptions;
  private queryId: string;
  private scheduler: QueryScheduler;
  private queryManager: QueryManager;

  constructor({
    scheduler,
    options,
    shouldSubscribe = true,
  }: {
    scheduler: QueryScheduler,
    options: WatchQueryOptions,
    shouldSubscribe?: boolean,
  }) {
    const queryManager = scheduler.queryManager;
    const queryId = queryManager.generateQueryId();
    const isPollingQuery = !!options.pollInterval;

    const subscriberFunction = (observer: Observer<ApolloQueryResult>) => {
      const retQuerySubscription = {
        unsubscribe: () => {
          if (isPollingQuery) {
            scheduler.stopPollingQuery(queryId);
          }
          queryManager.stopQuery(queryId);
        },
      };

      if (shouldSubscribe) {
        queryManager.addObservableQuery(queryId, this);
        queryManager.addQuerySubscription(queryId, retQuerySubscription);
      }

      if (isPollingQuery) {
        if (options.noFetch) {
          throw new Error('noFetch option should not use query polling.');
        }

        this.scheduler.startPollingQuery(
          options,
          queryId
        );
      }
      queryManager.startQuery(
        queryId,
        options,
        queryManager.queryListenerForObserver(queryId, options, observer)
      );

      return retQuerySubscription;
    };
    super(subscriberFunction);
    this.options = options;
    this.scheduler = scheduler;
    this.queryManager = queryManager;
    this.queryId = queryId;

    this.refetch = (variables?: any) => {
      // If no new variables passed, use existing variables
      variables = variables || this.options.variables;
      if (this.options.noFetch) {
        throw new Error('noFetch option should not use query refetch.');
      }
      // Use the same options as before, but with new variables and forceFetch true
      return this.queryManager.fetchQuery(this.queryId, assign(this.options, {
        forceFetch: true,
        variables,
      }) as WatchQueryOptions);
    };

    this.fetchMore = (fetchMoreLocations: string[], variables?: any) => {
      if (options.pollInterval) {
        throw new Error('fetchMore is incompatible with polling.');
      }
      return this.queryManager.fetchQuery(this.queryId, assign(this.options, {
        forceFetch: true,
        fetchMoreLocations,
        variables,
      }) as WatchQueryOptions);
    };

    this.stopPolling = () => {
      this.queryManager.stopQuery(this.queryId);
      if (isPollingQuery) {
        this.scheduler.stopPollingQuery(this.queryId);
      }
    };

    this.startPolling = (pollInterval) => {
      if (this.options.noFetch) {
        throw new Error('noFetch option should not use query polling.');
      }

      if (isPollingQuery) {
        this.scheduler.stopPollingQuery(this.queryId);
      }
      options.pollInterval = pollInterval;
      this.scheduler.startPollingQuery(this.options, this.queryId, false);
    };
  }

  public result(): Promise<ApolloQueryResult> {
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
}
