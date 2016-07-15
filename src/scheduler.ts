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

  // Map going from query ids to the query options associated with those queries. Contains all of
  // the queries, both in flight and not in flight.
  public registeredQueries: { [queryId: string]: WatchQueryOptions };

  // Map going from polling interval with to the query ids that fire on that interval.
  // These query ids are associated with a set of options in the this.registeredQueries.
  public intervalQueries: { [interval: number]: string[] };

  // We use this instance to actually fire queries (i.e. send them to the batching
  // mechanism).
  public queryManager: QueryManager;

  // Map going from polling interval widths to polling timers.
  private pollingTimers: { [interval: number]: NodeJS.Timer | any }; // oddity in Typescript

  constructor({
    queryManager,
  }: {
    queryManager: QueryManager;
  }) {
    this.queryManager = queryManager;
    this.pollingTimers = {};
    this.inFlightQueries = {};
    this.registeredQueries = {};
    this.intervalQueries = {};
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

  // The firstFetch option is used to denote whether we want to fire off a
  // "first fetch" before we start polling. If startPollingQuery() is being called
  // from an existing ObservableQuery, the first fetch has already been fired which
  // means that firstFetch should be false.
  public startPollingQuery(
    options: WatchQueryOptions,
    queryId?: string,
    firstFetch: boolean = true,
    listener?: QueryListener
  ): string {
    if (!queryId) {
      queryId = this.queryManager.generateQueryId();
    }

    this.registeredQueries[queryId] = options;

    // Fire an initial fetch before we start the polling query
    if (firstFetch) {
      this.fetchQuery(queryId, options);
    }

    if (listener) {
      this.queryManager.addQueryListener(queryId, listener);
    }
    this.addQueryOnInterval(queryId, options);

    return queryId;
  }

  public stopPollingQuery(queryId: string) {
    // Remove the query options from one of the registered queries.
    // The polling function will then take care of not firing it anymore.
    delete this.registeredQueries[queryId];
  }

  // Fires the all of the queries on a particular interval. Called on a setInterval.
  public fetchQueriesOnInterval(interval: number) {
    this.intervalQueries[interval] = this.intervalQueries[interval].filter((queryId) => {
      // If queryOptions can't be found from registeredQueries, it means that this queryId
      // is no longer registered and should be removed from the list of queries firing on this
      // interval.
      if (!this.registeredQueries.hasOwnProperty(queryId)) {
        return false;
      }

      // Don't fire this instance of the polling query is one of the instances is already in
      // flight.
      if (this.checkInFlight(queryId)) {
        return true;
      }

      const queryOptions = this.registeredQueries[queryId];
      const pollingOptions = assign({}, queryOptions) as WatchQueryOptions;
      pollingOptions.forceFetch = true;
      this.fetchQuery(queryId, pollingOptions);
      return true;
    });

    if (this.intervalQueries[interval].length === 0) {
      clearInterval(this.pollingTimers[interval]);
    }
  }

  // Adds a query on a particular interval to this.intervalQueries and then fires
  // that query with all the other queries executing on that interval. Note that the query id
  // and query options must have been added to this.registeredQueries before this function is called.
  public addQueryOnInterval(queryId: string, queryOptions: WatchQueryOptions) {
    const interval = queryOptions.pollInterval;

    // If there are other queries on this interval, this query will just fire with those
    // and we don't need to create a new timer.
    if (this.intervalQueries.hasOwnProperty(interval.toString())) {
      this.intervalQueries[interval].push(queryId);
    } else {
      this.intervalQueries[interval] = [queryId];
      // set up the timer for the function that will handle this interval
      this.pollingTimers[interval] = setInterval(() => {
        this.fetchQueriesOnInterval(interval);
      }, interval);
    }
  }

  // Used only for unit testing.
  public registerPollingQuery(queryOptions: WatchQueryOptions): ObservableQuery {
    if (!queryOptions.pollInterval) {
      throw new Error('Attempted to register a non-polling query with the scheduler.');
    }
    return new ObservableQuery({
      scheduler: this,
      options: queryOptions,
    });
  }

  private addInFlight(queryId: string, options: WatchQueryOptions) {
    this.inFlightQueries[queryId] = options;
  }

  private removeInFlight(queryId: string) {
    delete this.inFlightQueries[queryId];
  }
}
