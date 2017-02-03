import {
  Request,
} from './networkInterface';

import {
  ExecutionResult,
} from 'graphql';

export interface QueryFetchRequest {
  request: Request;

  // promise is created when the query fetch request is
  // added to the queue and is resolved once the result is back
  // from the server.
  promise?: Promise<ExecutionResult>;
  resolve?: (result: ExecutionResult) => void;
  reject?: (error: Error) => void;
};

// QueryBatcher operates on a queue  of QueryFetchRequests. It polls and checks this queue
// for new fetch requests. If there are multiple requests in the queue at a time, it will batch
// them together into one query.
export class QueryBatcher {
  // Queue on which the QueryBatcher will operate on a per-tick basis.
  public queuedRequests: QueryFetchRequest[] = [];

  private pollInterval: Number;
  private pollTimer: any;

  //This function is called to the queries in the queue to the server.
  private batchFetchFunction: (request: Request[]) => Promise<ExecutionResult[]>;

  constructor({
    batchFetchFunction,
  }: {
    batchFetchFunction: (request: Request[]) => Promise<ExecutionResult[]>,
  }) {
    this.queuedRequests = [];
    this.batchFetchFunction = batchFetchFunction;
  }

  public enqueueRequest(request: Request): Promise<ExecutionResult> {
    const fetchRequest: QueryFetchRequest = {
      request,
    };
    this.queuedRequests.push(fetchRequest);
    fetchRequest.promise = new Promise((resolve, reject) => {
      fetchRequest.resolve = resolve;
      fetchRequest.reject = reject;
    });

    return fetchRequest.promise;
  }

  // Consumes the queue. Called on a polling interval.
  // Returns a list of promises (one for each query).
  public consumeQueue(): (Promise<ExecutionResult> | undefined)[] | undefined {
    if (this.queuedRequests.length < 1) {
      return undefined;
    }

    const requests: Request[] = this.queuedRequests.map((queuedRequest) => {
      return {
        query: queuedRequest.request.query,
        variables: queuedRequest.request.variables,
        operationName: queuedRequest.request.operationName,
      };
    });

    const promises: (Promise<ExecutionResult> | undefined)[] = [];
    const resolvers: any[] = [];
    const rejecters: any[] = [];
    this.queuedRequests.forEach((fetchRequest, index) => {
      promises.push(fetchRequest.promise);
      resolvers.push(fetchRequest.resolve);
      rejecters.push(fetchRequest.reject);
    });

    this.queuedRequests = [];
    const batchedPromise = this.batchFetchFunction(requests);

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
  }

  // TODO instead of start and stop, just set a timeout when a request comes in,
  // and batch up everything in that interval. If no requests come in, don't batch.
  public start(pollInterval: Number) {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
    }
    this.pollInterval = pollInterval;
    this.pollTimer = setInterval(() => {
      this.consumeQueue();
    }, this.pollInterval);
  }

  public stop() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
    }
  }
}
