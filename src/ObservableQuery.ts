import { WatchQueryOptions, FetchMoreQueryOptions } from './watchQueryOptions';

import { Observable, Observer } from './util/Observable';

import {
  getQueryDefinition,
} from './queries/getFromAST';

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
  public fetchMore: (options: FetchMoreQueryOptions & FetchMoreOptions) => Promise<any>;
  public startGraphQLSubscription: () => number;
  public updateQuery: (mapFn: (previousQueryResult: any, options: UpdateQueryOptions) => any) => void;
  public stopPolling: () => void;
  public startPolling: (p: number) => void;
  public options: WatchQueryOptions;
  public queryId: string;
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
      // Extend variables if available
      variables = variables || this.options.variables ?
        assign({}, this.options.variables, variables) : undefined;

      if (this.options.noFetch) {
        throw new Error('noFetch option should not use query refetch.');
      }
      // Use the same options as before, but with new variables and forceFetch true
      return this.queryManager.fetchQuery(this.queryId, assign(this.options, {
        forceFetch: true,
        variables,
      }) as WatchQueryOptions);
    };

    this.fetchMore = (fetchMoreOptions: WatchQueryOptions & FetchMoreOptions) => {
      return Promise.resolve()
        .then(() => {
          const qid = this.queryManager.generateQueryId();
          let combinedOptions = null;

          if (fetchMoreOptions.query) {
            // fetch a new query
            combinedOptions = fetchMoreOptions;
          } else {
            // fetch the same query with a possibly new variables
            const variables = this.options.variables || fetchMoreOptions.variables ?
              assign({}, this.options.variables, fetchMoreOptions.variables) : undefined;

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
          const mapFn = (previousResult, { queryVariables }) => {
            return reducer(
              previousResult, {
                fetchMoreResult,
                queryVariables,
              });
          };
          this.updateQuery(mapFn);
        });
    };

    this.startGraphQLSubscription = () => {
      const subOptions = {
        query: this.options.query,
        variables: this.options.variables,
        fragments: this.options.fragments,
        handler: (error, result) => {
          this.queryManager.store.dispatch({
            type: 'APOLLO_UPDATE_QUERY_RESULT',
            newResult: result.data,
            queryVariables: this.options.variables,
            querySelectionSet: getQueryDefinition(this.options.query).selectionSet,
            queryFragments: this.options.fragments,
          });
        },
      };

      return this.queryManager.startSubscription(subOptions);
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
