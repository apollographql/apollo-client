import {
  ModifiableWatchQueryOptions,
  WatchQueryOptions,
  FetchMoreQueryOptions,
  SubscribeToMoreOptions,
} from './watchQueryOptions';

import { Observable, Observer, Subscription } from '../util/Observable';

import {
  QueryScheduler,
} from '../scheduler/scheduler';

import {
  ApolloError,
} from '../errors/ApolloError';

import {
  QueryManager,
  ApolloQueryResult,
} from './QueryManager';

import { tryFunctionOrLogError } from '../util/errorHandling';

import assign = require('lodash.assign');
import isEqual = require('lodash.isequal');

export interface FetchMoreOptions {
  updateQuery: (previousQueryResult: Object, options: {
    fetchMoreResult: Object,
    queryVariables: Object,
  }) => Object;
}

export interface UpdateQueryOptions {
  variables: Object;
}

export class ObservableQuery extends Observable<ApolloQueryResult> {
  public options: WatchQueryOptions;
  public queryId: string;
  /**
   *
   * The current value of the variables for this query. Can change.
   */
  public variables: { [key: string]: any };

  private isPollingQuery: boolean;
  private shouldSubscribe: boolean;
  private scheduler: QueryScheduler;
  private queryManager: QueryManager;
  private observers: Observer<ApolloQueryResult>[];
  private subscriptionHandles: Subscription[];

  private lastResult: ApolloQueryResult;
  private lastError: ApolloError;

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
      return this.onSubscribe(observer);
    };

    super(subscriberFunction);

    this.isPollingQuery = isPollingQuery;
    this.options = options;
    this.variables = this.options.variables || {};
    this.scheduler = scheduler;
    this.queryManager = queryManager;
    this.queryId = queryId;
    this.shouldSubscribe = shouldSubscribe;
    this.observers = [];
    this.subscriptionHandles = [];
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

  public currentResult(): ApolloQueryResult {
    const { data, partial } = this.queryManager.getCurrentQueryResult(this);
    const queryStoreValue = this.queryManager.getApolloState().queries[this.queryId];
    const queryLoading = !queryStoreValue || queryStoreValue.loading;

    // We need to be careful about the loading state we show to the user, to try
    // and be vaguely in line with what the user would have seen from .subscribe()
    // but to still provide useful information synchronously when the query
    // will not end up hitting the server.
    // See more: https://github.com/apollostack/apollo-client/issues/707
    // Basically: is there a query in flight right now (modolo the next tick)?
    const loading = (this.options.forceFetch && queryLoading)
      || (partial && !this.options.noFetch);

    return { data, loading };
  }

  public refetch(variables?: any): Promise<ApolloQueryResult> {
    this.variables = assign({}, this.variables, variables);

    if (this.options.noFetch) {
      throw new Error('noFetch option should not use query refetch.');
    }

    // Update the existing options with new variables
    assign(this.options, {
      variables: this.variables,
    });

    // Override forceFetch for this call only
    const combinedOptions = assign({}, this.options, {
      forceFetch: true,
    });

    return this.queryManager.fetchQuery(this.queryId, combinedOptions)
      .then(result => this.queryManager.transformResult(result));
  }

  public fetchMore(
    fetchMoreOptions: FetchMoreQueryOptions & FetchMoreOptions
  ): Promise<ApolloQueryResult> {
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
        const mapFn = (previousResult: any, { variables }: {variables: any }) => {

          // TODO REFACTOR: reached max recursion depth (figuratively) when renaming queryVariables.
          // Continue renaming to variables further down when we have time.
          const queryVariables = variables;
          return reducer(
            previousResult, {
              fetchMoreResult,
              queryVariables,
            });
        };
        this.updateQuery(mapFn);
        return fetchMoreResult;
      });
  }

  // XXX the subscription variables are separate from the query variables.
  // if you want to update subscription variables, right now you have to do that separately,
  // and you can only do it by stopping the subscription and then subscribing again with new variables.
  public subscribeToMore(
    options: SubscribeToMoreOptions,
  ): () => void {
    const observable = this.queryManager.startGraphQLSubscription({
      document: options.document,
      variables: options.variables,
    });

    const reducer = options.updateQuery;

    const subscription = observable.subscribe({
      next: (data) => {
        const mapFn = (previousResult: Object, { variables }: { variables: Object }) => {
          return reducer(
            previousResult, {
              subscriptionData: { data },
              variables,
            }
          );
        };
        this.updateQuery(mapFn);
      },
      error: (err) => {
        // TODO implement something smart here when improving error handling
        console.error(err);
      },
    });

    this.subscriptionHandles.push(subscription);

    return () => {
      const i = this.subscriptionHandles.indexOf(subscription);
      if (i >= 0) {
        this.subscriptionHandles.splice(i, 1);
        subscription.unsubscribe();
      }
    };
  }

  public setOptions(opts: ModifiableWatchQueryOptions): Promise<ApolloQueryResult> {
    const oldOptions = this.options;
    this.options = assign({}, this.options, opts) as WatchQueryOptions;

    if (opts.pollInterval) {
      this.startPolling(opts.pollInterval);
    } else if (opts.pollInterval === 0) {
      this.stopPolling();
    }

    // If forceFetch went from false to true
    if (!oldOptions.forceFetch && opts.forceFetch) {
      return this.queryManager.fetchQuery(this.queryId, this.options)
        .then(result => this.queryManager.transformResult(result));
    }

    return this.setVariables(this.options.variables);
  }

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
  public setVariables(variables: any): Promise<ApolloQueryResult> {
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
  }

  public updateQuery(
    mapFn: (previousQueryResult: any, options: UpdateQueryOptions) => any
  ): void {
    const {
      previousResult,
      variables,
      document,
    } = this.queryManager.getQueryWithPreviousResult(this.queryId);

    const newResult = tryFunctionOrLogError(
      () => mapFn(previousResult, { variables }));

    if (newResult) {
      this.queryManager.store.dispatch({
        type: 'APOLLO_UPDATE_QUERY_RESULT',
        newResult,
        variables,
        document,
      });
    }
  }

  public stopPolling() {
    if (this.isPollingQuery) {
      this.scheduler.stopPollingQuery(this.queryId);
    }
  }

  public startPolling(pollInterval: number) {
    if (this.options.noFetch) {
      throw new Error('noFetch option should not use query polling.');
    }

    if (this.isPollingQuery) {
      this.scheduler.stopPollingQuery(this.queryId);
    }
    this.options.pollInterval = pollInterval;
    this.scheduler.startPollingQuery(this.options, this.queryId, false);
  }

  private onSubscribe(observer: Observer<ApolloQueryResult>) {
    this.observers.push(observer);

    // Deliver initial result
    if (observer.next && this.lastResult) {
      observer.next(this.lastResult);
    }

    if (observer.error && this.lastError) {
      observer.error(this.lastError);
    }

    if (this.observers.length === 1) {
      this.setUpQuery();
    }

    const retQuerySubscription = {
      unsubscribe: () => {
        this.observers = this.observers.filter((obs) => obs !== observer);

        if (this.observers.length === 0) {
          this.tearDownQuery();
        }
      },
    };

    return retQuerySubscription;
  }

  private setUpQuery() {
    if (this.shouldSubscribe) {
      this.queryManager.addObservableQuery(this.queryId, this);
    }

    if (this.isPollingQuery) {
      if (this.options.noFetch) {
        throw new Error('noFetch option should not use query polling.');
      }

      this.scheduler.startPollingQuery(
        this.options,
        this.queryId
      );
    }

    const observer: Observer<ApolloQueryResult> = {
      next: (result: ApolloQueryResult) => {
        this.observers.forEach((obs) => {
          if (obs.next) {
            obs.next(result);
          }
        });

        this.lastResult = result;
      },
      error: (error: ApolloError) => {
        this.observers.forEach((obs) => {
          if (obs.error) {
            obs.error(error);
          } else {
            console.error('Unhandled error', error.message, error.stack);
          }
        });

        this.lastError = error;
      },
    };

    this.queryManager.startQuery(
      this.queryId,
      this.options,
      this.queryManager.queryListenerForObserver(this.queryId, this.options, observer)
    );
  }

  private tearDownQuery() {
    if (this.isPollingQuery) {
      this.scheduler.stopPollingQuery(this.queryId);
    }

    // stop all active GraphQL subscriptions
    this.subscriptionHandles.forEach( sub => sub.unsubscribe() );
    this.subscriptionHandles = [];

    this.queryManager.stopQuery(this.queryId);
    this.observers = [];
  }
}
