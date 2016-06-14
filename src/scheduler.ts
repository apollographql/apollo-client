// The QueryScheduler is supposed to be a mechanism that schedules polling queries such that
// they are clustered into the time slots of the QueryBatcher and are batched together. It
// also makes sure that for a given polling query, if one instance of the query is inflight,
// another instance will not be fired until the query returns or times out. We do this because if
// another query fires while one is already in flight, the data will stay in the "loading" state
// even after the first query has returned.

// At the moment, the QueryScheduler implements the one-polling-instance-at-a-time logic and
// adds queries to the QueryBatcher queue.

import {
  GraphQLResult,
} from 'graphql';

import {
  ObservableQuery,
  WatchQueryOptions,
  QueryManager,
  QueryListener,
} from './QueryManager';

import assign = require('lodash.assign');

export class QueryScheduler {
  // Map going from queryIds to query options that are in flight.
  public inFlightQueries: { [queryId: string]: WatchQueryOptions };

  // We use this instance to actually fire queries (i.e. send them to the batching
  // mechanism).
  private queryManager: QueryManager;

  // Map going from queryIds to polling timers.
  private pollingTimers: { [queryId: string]: NodeJS.Timer | any }; // oddity in Typescript

  constructor({
    queryManager,
  }: {
    queryManager: QueryManager;
  }) {
    this.queryManager = queryManager;
    this.pollingTimers = {};
    this.inFlightQueries = {};
  }

  public checkInFlight(queryId: string) {
    return !(this.inFlightQueries[queryId] === undefined);
  }

  public startPollingQuery(options: WatchQueryOptions, listener: QueryListener): string {
    const queryId = this.queryManager.generateQueryId();
    this.queryManager.addQueryListener(queryId, listener);

    // Fire an initial fetch before we start the polling query.
    this.queryManager.fetchQuery(queryId, options);
    this.addInFlight(queryId, options);

    this.pollingTimers[queryId] = setInterval(() => {
      const pollingOptions = assign({}, options) as WatchQueryOptions;
      pollingOptions.forceFetch = true;

      // We only fire the query if another instance of this same polling query isn't
      // already in flight. See top of this file for the reasoning as to why we do this.
      if (!this.checkInFlight(queryId)) {
        this.queryManager.fetchQuery(queryId, pollingOptions);
        this.addInFlight(queryId, options);
      }
    }, options.pollInterval);

    return queryId;
  }

  public stopPollingQuery(queryId: string) {
    // TODO should cancel in flight request so that there is no
    // further data returned.
    this.queryManager.removeQueryListener(queryId);

    if (this.pollingTimers[queryId]) {
      clearInterval(this.pollingTimers[queryId]);
    }

    // Fire a APOLLO_STOP_QUERY state change to the underlying store.
    this.queryManager.stopQueryInStore(queryId);
  }

  // Tell the QueryScheduler to schedule the queries fired by a polling query.
  public registerPollingQuery(options: WatchQueryOptions): ObservableQuery {
    if (!options.pollInterval) {
      throw new Error('Tried to register a non-polling query with the scheduler.');
    }

    return new ObservableQuery((observer) => {
      // "Fire" (i.e. add to the QueryBatcher queue)
      const queryListener = this.queryManager.queryListenerForObserver(options, observer);
      const queryId = this.startPollingQuery(options, queryListener);

      return {
        unsubscribe: () => {
          this.stopPollingQuery(queryId);
        },

        refetch: (variables: any): Promise<GraphQLResult> => {
          variables = variables || options.variables;
          return this.queryManager.fetchQuery(queryId, assign(options, {
            forceFetch: true,
            variables,
          }) as WatchQueryOptions);
        },

        startPolling: (pollInterval): void => {
          this.pollingTimers[queryId] = setInterval(() => {
            const pollingOptions = assign({}, options) as WatchQueryOptions;
            pollingOptions.forceFetch = true;
            this.queryManager.fetchQuery(queryId, pollingOptions);
          }, pollInterval);
        },
      };
    });
  }

  private addInFlight(queryId: string, options: WatchQueryOptions) {
    this.inFlightQueries[queryId] = options;
  }
}
