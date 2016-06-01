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
export class QueryScheduler {
  // Queue on which the QueryScheduler will operate on a per-tick basis
  public fetchRequests: QueryFetchRequest[];

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

    const res: Promise<GraphQLResult>[] = this.fetchRequests.map((fetchRequest) => {
      return this.queryManager.fetchQuery(fetchRequest.queryId, fetchRequest.options);
    });
    this.fetchRequests = [];
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
}



