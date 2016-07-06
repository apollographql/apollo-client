// The QueryScheduler is supposed to be a mechanism that schedules polling queries such that
// they are clustered into the time slots of the QueryBatcher and are batched together. It
// also makes sure that for a given polling query, if one instance of the query is inflight,
// another instance will not be fired until the query returns or times out. We do this because
// another query fires while one is already in flight, the data will stay in the "loading" state
// even after the first query has returned.

// At the moment, the QueryScheduler implements the one-polling-instance-at-a-time logic and
// adds queries to the QueryBatcher queue.

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
    return this.inFlightQueries.hasOwnProperty(queryId);
  }

  public fetchQuery(queryId: string, options: WatchQueryOptions) {
    return new Promise((resolve, reject) => {
      this.queryManager.fetchQuery(queryId, options).then((result) => {
        this.removeInFlight(queryId);
        resolve(result);
      }).catch((error) => {
        this.removeInFlight(queryId);
        reject(error);
      });
      this.addInFlight(queryId, options);
    });
  }

  public startPollingQuery(options: WatchQueryOptions, listener: QueryListener,
    queryId?: string): string {
    if (!queryId) {
      queryId = this.queryManager.generateQueryId();
    }
    // Fire an initial fetch before we start the polling query
    this.fetchQuery(queryId, options);
    this.queryManager.addQueryListener(queryId, listener);

    this.pollingTimers[queryId] = setInterval(() => {
      const pollingOptions = assign({}, options) as WatchQueryOptions;
      pollingOptions.forceFetch = true;

      // We only fire the query if another instance of this same polling query isn't
      // already in flight. See top of this file for the reasoning as to why we do this.
      if (!this.checkInFlight(queryId)) {
        this.fetchQuery(queryId, pollingOptions);
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
    const queryId = this.queryManager.generateQueryId();
    return new ObservableQuery(
      (observer) => {
        // "Fire" (i.e. add to the QueryBatcher queue)
        const queryListener = this.queryManager.queryListenerForObserver(options, observer);
        this.startPollingQuery(options, queryListener, queryId);

        return {
          unsubscribe: () => {
            this.stopPollingQuery(queryId);
          },
        };
      },
      (variables: any) => {
        variables = variables || options.variables;
        return this.fetchQuery(queryId, assign(options, {
          forceFetch: true,
          variables,
        }) as WatchQueryOptions);
      },
      () => {
        this.pollingTimers[queryId] = setInterval(() => {
          const pollingOptions = assign({}, options) as WatchQueryOptions;
          pollingOptions.forceFetch = true;
          this.fetchQuery(queryId, pollingOptions).then(() => {
            this.removeInFlight(queryId);
          });
        }, options.pollInterval);
      },
      () => {
        this.stopPollingQuery(queryId);
      }
    );
  }

  private addInFlight(queryId: string, options: WatchQueryOptions) {
    this.inFlightQueries[queryId] = options;
  }

  private removeInFlight(queryId: string) {
    delete this.inFlightQueries[queryId];
  }
}
