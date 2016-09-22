import {
  ModifiableWatchQueryOptions,
  WatchQueryOptions,
  FetchMoreQueryOptions,
} from './watchQueryOptions';

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

import { tryFunctionOrLogError } from './util/errorHandling';

import assign = require('lodash.assign');
import isEqual = require('lodash.isequal');

export interface FetchMoreOptions {
  updateQuery: (previousQueryResult: Object, options: {
    fetchMoreResult: Object,
    queryVariables: Object,
  }) => Object;
}

export interface UpdateQueryOptions {
  queryVariables: Object;
}

export class ObservableQuery extends Observable<ApolloQueryResult> {
  public refetch: (variables?: any) => Promise<ApolloQueryResult>;
  /**
   * Reset this query to take a new set of options.
   */
  public setOptions: (options: ModifiableWatchQueryOptions) => Promise<ApolloQueryResult>;
  /**
   * Update the variables of this observable query, and fetch the new results
   * if they've changed. If you want to force new results, use `refetch`.
   *
   * Note: if the variables have not changed, the promise will return the old
   * results immediately, and the `next` callback will *not* fire.
   *
   * @param variables: The new set of variables. If there are missing variables,
   * the previous values of those variables will be used.
   */
  public setVariables: (variables: any) => Promise<ApolloQueryResult>;
  public fetchMore: (options: FetchMoreQueryOptions & FetchMoreOptions) => Promise<any>;
  public updateQuery: (mapFn: (previousQueryResult: any, options: UpdateQueryOptions) => any) => void;
  public stopPolling: () => void;
  public startPolling: (p: number) => void;
  public options: WatchQueryOptions;
  public queryId: string;
  /**
   *
   * The current value of the variables for this query. Can change.
   */
  public variables: { [key: string]: any };
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
        if (this.options.noFetch) {
          throw new Error('noFetch option should not use query polling.');
        }

        this.scheduler.startPollingQuery(
          this.options,
          queryId
        );
      }
      queryManager.startQuery(
        queryId,
        this.options,
        queryManager.queryListenerForObserver(queryId, this.options, observer)
      );

      return retQuerySubscription;
    };
    super(subscriberFunction);
    this.options = options;
    this.variables = this.options.variables || {};
    this.scheduler = scheduler;
    this.queryManager = queryManager;
    this.queryId = queryId;

    this.refetch = (variables?: any) => {
      this.variables = assign({}, this.variables, variables);

      if (this.options.noFetch) {
        throw new Error('noFetch option should not use query refetch.');
      }
      // Use the same options as before, but with new variables and forceFetch true
      return this.queryManager.fetchQuery(this.queryId, assign(this.options, {
        forceFetch: true,
        variables: this.variables,
      }) as WatchQueryOptions)
      .then(result => this.queryManager.transformResult(result));
    };

    this.setOptions = (opts: ModifiableWatchQueryOptions) => {
      this.options = assign({}, this.options, opts) as WatchQueryOptions;
      if (opts.pollInterval) {
        this.startPolling(opts.pollInterval);
      } else if (opts.pollInterval === 0) {
        this.stopPolling();
      }

      return this.setVariables(opts.variables);
    };

    // There's a subtle difference between setVariables and refetch:
    //   - setVariables will take results from the store unless the query
    //   is marked forceFetch (and definitely if the variables haven't changed)
    //   - refetch will always go to the server
    this.setVariables = (variables: any) => {
      const newVariables = assign({}, this.variables, variables);

      if (isEqual(newVariables, this.variables)) {
        return this.result();
      } else {
        this.variables = newVariables;
        // Use the same options as before, but with new variables
        return this.queryManager.fetchQuery(this.queryId, assign(this.options, {
          variables: this.variables,
        }) as WatchQueryOptions)
        .then(result => this.queryManager.transformResult(result));
      }
    };

    this.fetchMore = (fetchMoreOptions: WatchQueryOptions & FetchMoreOptions) => {
      return Promise.resolve()
        .then(() => {
          const qid = this.queryManager.generateQueryId();
          let combinedOptions: any = null;

          if (fetchMoreOptions.query) {
            // fetch a new query
            combinedOptions = fetchMoreOptions;
          } else {
            // fetch the same query with a possibly new variables
            const variables = assign({}, this.variables, fetchMoreOptions.variables);

            combinedOptions = assign({}, this.options, fetchMoreOptions, {
              variables,
            });
          }

          combinedOptions = assign({}, combinedOptions, {
            forceFetch: true,
          }) as WatchQueryOptions;
          return this.queryManager.fetchQuery(qid, combinedOptions);
        })
        .then((fetchMoreResult) => {
          const reducer = fetchMoreOptions.updateQuery;
          const mapFn = (previousResult: any, { queryVariables }: {queryVariables: any }) => {
            return reducer(
              previousResult, {
                fetchMoreResult,
                queryVariables,
              });
          };
          this.updateQuery(mapFn);
          return fetchMoreResult;
        });
    };

    this.updateQuery = (mapFn) => {
      const {
        previousResult,
        queryVariables,
        querySelectionSet,
        queryFragments = [],
      } = this.queryManager.getQueryWithPreviousResult(this.queryId);
      const newResult = tryFunctionOrLogError(
        () => mapFn(previousResult, { queryVariables }));

      if (newResult) {
        this.queryManager.store.dispatch({
          type: 'APOLLO_UPDATE_QUERY_RESULT',
          newResult,
          queryVariables,
          querySelectionSet,
          queryFragments,
        });
      }
    };

    this.stopPolling = () => {
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
      this.options.pollInterval = pollInterval;
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
