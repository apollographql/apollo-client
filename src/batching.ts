import {
  WatchQueryOptions,
  QueryManager,
} from './QueryManager';

import {
  GraphQLResult,
} from 'graphql';

export interface QueryFetchRequest {
  options: WatchQueryOptions;
  queryId: string;
};

// QueryScheduler takes a operates on a queue  of QueryFetchRequests. It polls and checks this queue
// for new fetch requests. If there are multiple requests in the queue at a time, it will batch
// them together into one query. Batching can be toggled with the shouldBatch option.
// Conditions this tries to guarantee:
// - For polling queries, there should be only one query in flight at a time.
export class QueryScheduler {
  // Queue on which the QueryScheduler will operate on a per-tick basis.
  public fetchRequests: QueryFetchRequest[];
  // Table (from query id to QueryFetchRequest) which contains requests that are currently in-flight.
  public inFlightRequests: { [queryId: string]: QueryFetchRequest };

  private shouldBatch: Boolean;
  private pollInterval: Number;
  private pollTimer: NodeJS.Timer | any; //oddity in Typescript

  //This instance is used to call fetchQuery() and send the queries in the
  //queue to the server.
  private queryManager: QueryManager;

  constructor({
    shouldBatch,
    queryManager,
  }: {
    shouldBatch: Boolean,
    queryManager: QueryManager,
  }) {
    this.shouldBatch = shouldBatch;
    this.fetchRequests = [];
    this.inFlightRequests = {};
    this.queryManager = queryManager;
  }

  public queueRequest(request: QueryFetchRequest) {
    this.fetchRequests.push(request);
  }

  // Consumes the queue. Called on a polling interval, exposed publicly
  // in order to unit test. Returns a list of promises for each of the queries
  // fetched primarily for unit testing purposes.
  public consumeQueue(): Promise<GraphQLResult>[] {
    if (this.fetchRequests.length < 1) {
      return;
    }

    const res: Promise<GraphQLResult>[] = [];
    const { toLeaveInQueue, toFetch } =
      this.splitFetchRequests(this.fetchRequests);

    this.fetchRequests = toLeaveInQueue;
    toFetch.forEach((fetchRequest) => {
      this.addInFlight(fetchRequest);
      const promise = this.queryManager.fetchQuery(fetchRequest.queryId,
                                                   fetchRequest.options)
        .then((result) => {
          return this.handleResult(fetchRequest.queryId, result);
        });
      res.push(promise);
    });

    return res;
  }

  public start(pollInterval: Number) {
    this.pollInterval = pollInterval;
    this.pollTimer = setInterval(this.consumeQueue);
  }

  public stop() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
    }
  }

  // Takes the queue of QueryFetchRequests and returns two pieces
  // of it. The first piece is the stuff that we have to leave in the queue
  // due to some condition (e.g. in flight polling queries) and the second
  // piece is the stuff we want to actually send to the server.
  private splitFetchRequests(
    fetchRequests: QueryFetchRequest[]): {toLeaveInQueue: QueryFetchRequest[],
                                          toFetch: QueryFetchRequest[]} {
    const toLeaveInQueue: QueryFetchRequest[] = [];
    const toFetch = fetchRequests.filter((fetchRequest) => {
      if (this.checkInFlight(fetchRequest)) {
        //if a query is in flight, we don't want to send out another one
        //so, we keep this one in the queue.
        toLeaveInQueue.push(fetchRequest);
        return false;
      } else {
        return true;
      }
    });

    return {toLeaveInQueue, toFetch};
  }

  private addInFlight(fetchRequest: QueryFetchRequest): void {
    this.inFlightRequests[fetchRequest.queryId] = fetchRequest;
  }

  private checkInFlight(fetchRequest: QueryFetchRequest): Boolean {
    if (this.inFlightRequests[fetchRequest.queryId]) {
      return true;
    } else {
      return false;
    }
  }

  // Called when we receive a response from the server for a particular QueryFetchRequest.
  // Responsible for evicting that QueryFetchRequest from the inFlightRequests table.
  private handleResult(queryId: string, result: GraphQLResult): GraphQLResult {
    if (this.inFlightRequests[queryId]) {
      delete this.inFlightRequests[queryId];
    }

    return result;
  }
}
