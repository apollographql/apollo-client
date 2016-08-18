import { WatchQueryOptions, FetchMoreQueryOptions } from './watchQueryOptions';

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

import {
  getQueryDefinition,
} from './queries/getFromAST';

import {
  ApolloError,
} from './errors';

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

    this.updateQuery = (mapFn) => {
      const {
        previousResult,
        queryVariables,
        querySelectionSet,
        queryFragments = [],
      } = this.queryManager.getQueryWithPreviousResult(this.queryId);

      const queryDef = getQueryDefinition(this.options.query);
      const queryName = (queryDef.name && queryDef.name.value) || '<anonymous query>';

      const newResult = tryFunctionOrLogError(
        () => mapFn(previousResult, { queryVariables }));

      if (newResult) {
        try {
          this.queryManager.store.dispatch({
            type: 'APOLLO_UPDATE_QUERY_RESULT',
            newResult,
            queryVariables,
            querySelectionSet,
            queryFragments,
          });
        } catch (err) {
          if ((err instanceof ApolloError) && err.extraInfo['isFieldError']) {
            const missingField = err.extraInfo['missingField'];
            const extraField = err.extraInfo['extraField'];
            const dataId = err.extraInfo['dataId'];
            const errorMessage = missingField ?
              `updateQuery function for the query ${queryName} returned a shape missing a field ${missingField} on object ${dataId}` :
              `updateQuery function for the query ${queryName} returned a shape with an extra field ${extraField} on object ${dataId}`;

            throw new ApolloError({
              errorMessage,
              extraInfo: {
                queryName,
                queryVariables,
                newResult,
              },
            });
          }
        }
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
