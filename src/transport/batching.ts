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
}

// QueryBatcher doesn't fire requests immediately. Requests that were enqueued within
// a certain amount of time (configurable through `batchInterval`) will be batched together
// into one query.
export class QueryBatcher {
  // Queue on which the QueryBatcher will operate on a per-tick basis.
  public queuedRequests: QueryFetchRequest[] = [];

  private batchInterval: Number;

  //This function is called to the queries in the queue to the server.
  private batchFetchFunction: (request: Request[]) => Promise<ExecutionResult[]>;

  constructor({
    batchInterval,
    batchFetchFunction,
  }: {
    batchInterval: number,
    batchFetchFunction: (request: Request[]) => Promise<ExecutionResult[]>,
  }) {
    this.queuedRequests = [];
    this.batchInterval = batchInterval;
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

    // The first enqueued request triggers the queue consumption after `batchInterval` milliseconds.
    if (this.queuedRequests.length === 1) {
      this.scheduleQueueConsumption();
    }

    return fetchRequest.promise;
  }

  // Consumes the queue.
  // Returns a list of promises (one for each query).
  public consumeQueue(): (Promise<ExecutionResult> | undefined)[] | undefined {
    const requests: Request[] = this.queuedRequests.map(
      (queuedRequest) => queuedRequest.request,
    );

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

  private scheduleQueueConsumption(): void {
    setTimeout(() => {
      this.consumeQueue();
    }, this.batchInterval);
  }
}
