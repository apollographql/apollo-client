import {
  WatchQueryOptions,
} from './QueryManager';

import {
  NetworkInterface,
  Request,
  BatchedNetworkInterface,
} from './networkInterface';

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
export class QueryBatcher {
  // Queue on which the QueryScheduler will operate on a per-tick basis.
  public fetchRequests: QueryFetchRequest[];

  private shouldBatch: Boolean;
  private pollInterval: Number;
  private pollTimer: NodeJS.Timer | any; //oddity in Typescript

  //This instance is used to call batchQuery() and send the queries in the
  //queue to the server.
  private networkInterface: NetworkInterface;

  constructor({
    shouldBatch,
    networkInterface,
  }: {
    shouldBatch: Boolean,
    networkInterface: NetworkInterface,
  }) {
    this.shouldBatch = shouldBatch;
    this.fetchRequests = [];
    this.networkInterface = networkInterface;
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

    const requests: Request[] = this.fetchRequests.map((fetchRequests) => {
      return {
        query: fetchRequests.options.query,
        variables: fetchRequests.options.variables,
      };
    });

    if (this.shouldBatch) {
      this.fetchRequests = [];
      const promises: Promise<GraphQLResult>[] = [];
      const resolvers = [];
      requests.forEach(() => {
        const promise = new Promise((resolve) => {
          resolvers.push(resolve);
        });
        promises.push(promise);
      });

      const batchedPromise =
        (this.networkInterface as BatchedNetworkInterface).batchQuery(requests);
      batchedPromise.then((results) => {
        results.forEach((result, index) => {
          resolvers[index](result);
        });
      });
      return promises;
    } else {
      const res: Promise<GraphQLResult>[] = [];
      requests.forEach((request) => {
        const promise = this.networkInterface.query(request);
        res.push(promise);
      });
      return res;
    }
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
