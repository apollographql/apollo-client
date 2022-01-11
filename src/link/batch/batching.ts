import { Operation, FetchResult, NextLink } from '../core';
import { Observable, ObservableSubscription } from '../../utilities';

export type BatchHandler = (
  operations: Operation[],
  forward?: (NextLink | undefined)[],
) => Observable<FetchResult[]> | null;

export interface BatchableRequest {
  operation: Operation;
  forward?: NextLink;
  observable?: Observable<FetchResult>;
  next?: Array<(result: FetchResult) => void>;
  error?: Array<(error: Error) => void>;
  complete?: Array<() => void>;
}

interface QueuedRequest extends BatchableRequest {
  next: Array<(result: FetchResult) => void>;
  error: Array<(error: Error) => void>;
  complete: Array<() => void>;
  subscribers: number;
}

// QueryBatcher doesn't fire requests immediately. Requests that were enqueued within
// a certain amount of time (configurable through `batchInterval`) will be batched together
// into one query.
export class OperationBatcher {
  // Queue on which the QueryBatcher will operate on a per-tick basis.
  // Public only for testing
  public readonly queuedRequests = new Map<string, {
    requests: QueuedRequest[],
    batchedSubscription?: ObservableSubscription
  }>();

  private scheduledBatchTimer: ReturnType<typeof setTimeout>;
  private batchDebounce?: boolean;
  private batchInterval?: number;
  private batchMax: number;

  //This function is called to the queries in the queue to the server.
  private batchHandler: BatchHandler;
  private batchKey: (operation: Operation) => string;

  constructor({
    batchDebounce,
    batchInterval,
    batchMax,
    batchHandler,
    batchKey,
  }: {
    batchDebounce?: boolean;
    batchInterval?: number;
    batchMax?: number;
    batchHandler: BatchHandler;
    batchKey?: (operation: Operation) => string;
  }) {
    this.batchDebounce = batchDebounce;
    this.batchInterval = batchInterval;
    this.batchMax = batchMax || 0;
    this.batchHandler = batchHandler;
    this.batchKey = batchKey || (() => '');
  }

  public enqueueRequest(request: BatchableRequest): Observable<FetchResult> {
    const requestCopy: QueuedRequest = {
      ...request,
      next: [],
      error: [],
      complete: [],
      subscribers: 0,
    };

    const key = this.batchKey(request.operation);

    if (!requestCopy.observable) {
      requestCopy.observable = new Observable<FetchResult>(observer => {
        if (!this.queuedRequests.has(key)) {
          this.queuedRequests.set(key, {requests: []});
        }
        const queuedRequests = this.queuedRequests.get(key)!;

        requestCopy.subscribers++;
        if (requestCopy.subscribers === 1) {
          queuedRequests.requests.push(requestCopy);
        }

        // called for each subscriber, so need to save all listeners (next, error, complete)
        if (observer.next) {
          requestCopy.next.push(observer.next.bind(observer));
        }

        if (observer.error) {
          requestCopy.error.push(observer.error.bind(observer));
        }

        if (observer.complete) {
          requestCopy.complete.push(observer.complete.bind(observer));
        }

        // The first enqueued request triggers the queue consumption after `batchInterval` milliseconds.
        if (queuedRequests.requests.length === 1) {
          this.scheduleQueueConsumption(key);
        } else if (this.batchDebounce) {
          clearTimeout(this.scheduledBatchTimer);
          this.scheduleQueueConsumption(key);
        }

        // When amount of requests reaches `batchMax`, trigger the queue consumption without waiting on the `batchInterval`.
        if (queuedRequests.requests.length === this.batchMax) {
          this.consumeQueue(key);
        }

        return () => {
          requestCopy.subscribers--;

          // If this is last subscriber for this request, remove request from queue
          if (requestCopy.subscribers < 1) {
            const index = queuedRequests.requests.indexOf(requestCopy);
            if (index !== undefined && index > -1) {
              queuedRequests.requests.splice(index, 1);

              // If this is last request from queue, remove queue entirely
              if (queuedRequests.requests.length === 0) {
                clearTimeout(this.scheduledBatchTimer);
                this.queuedRequests.delete(key);

                // If queue was in flight, cancel it
                queuedRequests.batchedSubscription?.unsubscribe();
              }
            }
          }
        }
      });
    }

    return requestCopy.observable;
  }

  // Consumes the queue.
  // Returns a list of promises (one for each query).
  public consumeQueue(
    key?: string,
  ): (Observable<FetchResult> | undefined)[] | undefined {
    const requestKey = key || '';
    const queuedRequests = this.queuedRequests.get(requestKey);

    if (!queuedRequests) {
      return;
    }

    this.queuedRequests.delete(requestKey);

    const operations: Operation[] = [];
    const forwards: (NextLink | undefined)[] = [];
    const observables: (Observable<FetchResult> | undefined)[] = [];
    const nexts: Array<(result: FetchResult) => void>[] = [];
    const errors: Array<(error: Error) => void>[] = [];
    const completes: Array<() => void>[] = [];

    queuedRequests.requests.forEach(request => {
      operations.push(request.operation);
      forwards.push(request.forward);
      observables.push(request.observable);
      nexts.push(request.next);
      errors.push(request.error);
      completes.push(request.complete);
    });

    const batchedObservable =
      this.batchHandler(operations, forwards) || Observable.of();

    const onError = (error: any) => {
      //each callback list in batch
      errors.forEach(rejecters => {
        if (rejecters) {
          //each subscriber to request
          rejecters.forEach((e: any) => e(error));
        }
      });
    };

    queuedRequests.batchedSubscription = batchedObservable.subscribe({
      next: results => {
        if (!Array.isArray(results)) {
          results = [results];
        }

        if (nexts.length !== results.length) {
          const error = new Error(
            `server returned results with length ${
              results.length
            }, expected length of ${nexts.length}`,
          );
          (error as any).result = results;

          return onError(error);
        }

        results.forEach((result, index) => {
          if (nexts[index]) {
            nexts[index].forEach((next: any) => next(result));
          }
        });
      },
      error: onError,
      complete: () => {
        completes.forEach(complete => {
          if (complete) {
            //each subscriber to request
            complete.forEach((c: any) => c());
          }
        });
      },
    });

    return observables;
  }

  private scheduleQueueConsumption(key: string): void {
    this.scheduledBatchTimer = setTimeout(() => {
      if (this.queuedRequests.get(key)?.requests.length) {
        this.consumeQueue(key);
      }
    }, this.batchInterval);
  }
}
