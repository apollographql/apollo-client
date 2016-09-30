import {
  WatchQueryOptions,
} from './watchQueryOptions';

import {
  NetworkInterface,
  Request,
  BatchedNetworkInterface,
} from './networkInterface';

import {
  GraphQLResult,
} from 'graphql';

import cloneDeep = require('lodash.clonedeep');

export interface QueryFetchRequest {
  options: WatchQueryOptions;
  queryId: string;
  operationName?: string;

  // promise is created when the query fetch request is
  // added to the queue and is resolved once the result is back
  // from the server.
  promise?: Promise<GraphQLResult>;
  resolve?: (result: GraphQLResult) => void;
  reject?: (error: Error) => void;
};

// QueryBatcher takes a operates on a queue  of QueryFetchRequests. It polls and checks this queue
// for new fetch requests. If there are multiple requests in the queue at a time, it will batch
// them together into one query. Batching can be toggled with the shouldBatch option.
export class QueryBatcher {
  // Queue on which the QueryBatcher will operate on a per-tick basis.
  public queuedRequests: QueryFetchRequest[] = [];

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
    this.queuedRequests = [];
    this.networkInterface = networkInterface;
  }

  public enqueueRequest(request: QueryFetchRequest): Promise<GraphQLResult> {
    this.queuedRequests.push(request);
    request.promise = new Promise((resolve, reject) => {
      request.resolve = resolve;
      request.reject = reject;
    });

    if (!this.shouldBatch) {
      this.consumeQueue();
    }

    return request.promise;
  }

  // Consumes the queue. Called on a polling interval.
  // Returns a list of promises (one for each query).
  public consumeQueue(): Promise<GraphQLResult>[] | undefined {
    if (this.queuedRequests.length < 1) {
      return undefined;
    }

    const requests: Request[] = this.queuedRequests.map((queuedRequest) => {
      return {
        query: queuedRequest.options.query,
        variables: queuedRequest.options.variables,
        operationName: queuedRequest.operationName,
      };
    });

    const promises: Promise<GraphQLResult>[] = [];
    const resolvers: any[] = [];
    const rejecters: any[] = [];
    this.queuedRequests.forEach((fetchRequest, index) => {
      promises.push(fetchRequest.promise);
      resolvers.push(fetchRequest.resolve);
      rejecters.push(fetchRequest.reject);
    });

    if (this.shouldBatch) {
      this.queuedRequests = [];
      const batchedPromise =
        (this.networkInterface as BatchedNetworkInterface).batchQuery(requests);

      batchedPromise.then((results) => {
        results.forEach((result, index) => {
          resolvers[index](result);
        });
      }).catch((error) => {
        rejecters.forEach((rejecter, index) => {
          rejecters[index](error);
        });
      });
      return promises;
    } else {
      const clonedRequests = cloneDeep(this.queuedRequests);
      this.queuedRequests = [];
      clonedRequests.forEach((fetchRequest: any, index: number) => {
        this.networkInterface.query(requests[index]).then((result) => {
          resolvers[index](result);
        }).catch((reason) => {
          rejecters[index](reason);
        });
      });

      return promises;
    }
  }

  public start(pollInterval: Number) {
    if (this.shouldBatch) {
      this.pollInterval = pollInterval;
      this.pollTimer = setInterval(() => {
        this.consumeQueue();
      }, this.pollInterval);
    }
  }

  public stop() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
    }
  }
}
