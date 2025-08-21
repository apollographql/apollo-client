import type { Subscription } from "rxjs";
import { Observable } from "rxjs";

import type { ApolloLink } from "@apollo/client/link";

import type { BatchLink } from "./batchLink.js";

export interface BatchableRequest {
  operation: ApolloLink.Operation;
  forward: ApolloLink.ForwardFunction;
}

type QueuedRequest = BatchableRequest & {
  observable?: Observable<ApolloLink.Result>;
  next: Array<(result: ApolloLink.Result) => void>;
  error: Array<(error: Error) => void>;
  complete: Array<() => void>;
  subscribers: Set<object>;
};

// Batches are primarily a Set<QueuedRequest>, but may have other optional
// properties, such as batch.subscription.
type RequestBatch = Set<QueuedRequest> & {
  subscription?: Subscription;
};

// QueryBatcher doesn't fire requests immediately. Requests that were enqueued within
// a certain amount of time (configurable through `batchInterval`) will be batched together
// into one query.
export class OperationBatcher {
  // Queue on which the QueryBatcher will operate on a per-tick basis.
  private batchesByKey = new Map<string, RequestBatch>();

  private scheduledBatchTimerByKey = new Map<
    string,
    ReturnType<typeof setTimeout>
  >();
  private batchDebounce?: boolean;
  private batchInterval?: number;
  private batchMax: number;

  //This function is called to the queries in the queue to the server.
  private batchHandler: BatchLink.BatchHandler;
  private batchKey: (operation: ApolloLink.Operation) => string;

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
    batchHandler: BatchLink.BatchHandler;
    batchKey?: (operation: ApolloLink.Operation) => string;
  }) {
    this.batchDebounce = batchDebounce;
    this.batchInterval = batchInterval;
    this.batchMax = batchMax || 0;
    this.batchHandler = batchHandler;
    this.batchKey = batchKey || (() => "");
  }

  public enqueueRequest(
    request: BatchableRequest
  ): Observable<ApolloLink.Result> {
    const requestCopy: QueuedRequest = {
      ...request,
      next: [],
      error: [],
      complete: [],
      subscribers: new Set(),
    };

    const key = this.batchKey(request.operation);

    if (!requestCopy.observable) {
      requestCopy.observable = new Observable<ApolloLink.Result>((observer) => {
        let batch = this.batchesByKey.get(key)!;
        if (!batch) this.batchesByKey.set(key, (batch = new Set()));

        // These booleans seem to me (@benjamn) like they might always be the
        // same (and thus we could do with only one of them), but I'm not 100%
        // sure about that.
        const isFirstEnqueuedRequest = batch.size === 0;
        const isFirstSubscriber = requestCopy.subscribers.size === 0;
        requestCopy.subscribers.add(observer);
        if (isFirstSubscriber) {
          batch.add(requestCopy);
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
        if (isFirstEnqueuedRequest || this.batchDebounce) {
          this.scheduleQueueConsumption(key);
        }

        // When amount of requests reaches `batchMax`, trigger the queue consumption without waiting on the `batchInterval`.
        if (batch.size === this.batchMax) {
          this.consumeQueue(key);
        }

        return () => {
          // If this is last subscriber for this request, remove request from queue
          if (
            requestCopy.subscribers.delete(observer) &&
            requestCopy.subscribers.size < 1
          ) {
            // If this is last request from queue, remove queue entirely
            if (batch.delete(requestCopy) && batch.size < 1) {
              this.consumeQueue(key);
              // If queue was in flight, cancel it
              batch.subscription?.unsubscribe();
            }
          }
        };
      });
    }

    return requestCopy.observable;
  }

  // Consumes the queue.
  // Returns a list of promises (one for each query).
  public consumeQueue(
    key: string = ""
  ): (Observable<ApolloLink.Result> | undefined)[] | undefined {
    const batch = this.batchesByKey.get(key);
    // Delete this batch and process it below.
    this.batchesByKey.delete(key);
    if (!batch || !batch.size) {
      // No requests to be processed.
      return;
    }

    const operations: QueuedRequest["operation"][] = [];
    const forwards: QueuedRequest["forward"][] = [];
    const observables: QueuedRequest["observable"][] = [];
    const nexts: QueuedRequest["next"][] = [];
    const errors: QueuedRequest["error"][] = [];
    const completes: QueuedRequest["complete"][] = [];

    // Even though batch is a Set, it preserves the order of first insertion
    // when iterating (per ECMAScript specification), so these requests will be
    // handled in the order they were enqueued (minus any deleted ones).
    batch.forEach((request) => {
      operations.push(request.operation);
      forwards.push(request.forward);
      observables.push(request.observable);
      nexts.push(request.next);
      errors.push(request.error);
      completes.push(request.complete);
    });

    const batchedObservable = this.batchHandler(operations, forwards);

    const onError = (error: Error) => {
      //each callback list in batch
      errors.forEach((rejecters) => {
        if (rejecters) {
          //each subscriber to request
          rejecters.forEach((e) => e(error));
        }
      });
    };

    batch.subscription = batchedObservable.subscribe({
      next: (results) => {
        if (!Array.isArray(results)) {
          results = [results];
        }

        if (nexts.length !== results.length) {
          const error = new Error(
            `server returned results with length ${results.length}, expected length of ${nexts.length}`
          );
          (error as any).result = results;

          return onError(error);
        }

        results.forEach((result, index) => {
          if (nexts[index]) {
            nexts[index].forEach((next) => next(result));
          }
        });
      },
      error: onError,
      complete: () => {
        completes.forEach((complete) => {
          if (complete) {
            //each subscriber to request
            complete.forEach((c) => c());
          }
        });
      },
    });

    return observables;
  }

  private scheduleQueueConsumption(key: string): void {
    clearTimeout(this.scheduledBatchTimerByKey.get(key));
    this.scheduledBatchTimerByKey.set(
      key,
      setTimeout(() => {
        this.consumeQueue(key);
        this.scheduledBatchTimerByKey.delete(key);
      }, this.batchInterval)
    );
  }
}
