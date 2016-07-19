import assign = require('lodash.assign');

import { Observable, Observer } from './util/Observable';

import { ApolloQueryResult } from './index';

import { WatchQueryOptions } from './watchQueryOptions';

import { QueryManager } from './QueryManager';

export class ObservableQuery extends Observable<ApolloQueryResult> {
  public refetch: (variables?: any) => Promise<ApolloQueryResult>;
  public stopPolling: () => void;
  public startPolling: (p: number) => void;
  public options: WatchQueryOptions;
  public queryManager: QueryManager;
  public queryId: string;

  constructor({
    queryManager,
    options,
    shouldSubscribe = true,
  }: {
    queryManager: QueryManager,
    options: WatchQueryOptions,
    shouldSubscribe?: boolean,
  }) {

    const queryId = queryManager.generateQueryId();
    const subscriberFunction = (observer: Observer<ApolloQueryResult>) => {
      const retQuerySubscription = {
        unsubscribe: () => {
          queryManager.stopQuery(queryId);
        },
      };

      if (shouldSubscribe) {
        queryManager.addObservableQuery(queryId, this);
        queryManager.addQuerySubscription(queryId, retQuerySubscription);
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

    this.stopPolling = () => {
      if (this.queryManager.pollingTimers[this.queryId]) {
        clearInterval(this.queryManager.pollingTimers[this.queryId]);
      }
    };

    this.startPolling = (pollInterval) => {
      if (this.options.noFetch) {
        throw new Error('noFetch option should not use query polling.');
      }
      this.queryManager.pollingTimers[this.queryId] = setInterval(() => {
        const pollingOptions = assign({}, this.options) as WatchQueryOptions;
        // subsequent fetches from polling always reqeust new data
        pollingOptions.forceFetch = true;
        this.queryManager.fetchQuery(this.queryId, pollingOptions);
      }, pollInterval);
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
