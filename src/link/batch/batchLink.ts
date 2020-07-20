import { ApolloLink, Operation, FetchResult, NextLink } from '../core';
import { Observable } from '../../utilities';
import { OperationBatcher, BatchHandler } from './batching';
export { OperationBatcher, BatchableRequest, BatchHandler } from './batching';

export namespace BatchLink {
  export interface Options {
    /**
     * The interval at which to batch, in milliseconds.
     *
     * Defaults to 10.
     */
    batchInterval?: number;

    /**
     * The maximum number of operations to include in one fetch.
     *
     * Defaults to 0 (infinite operations within the interval).
     */
    batchMax?: number;

    /**
     * The handler that should execute a batch of operations.
     */
    batchHandler?: BatchHandler;

    /**
     * creates the key for a batch
     */
    batchKey?: (operation: Operation) => string;
  }
}

export class BatchLink extends ApolloLink {
  private batcher: OperationBatcher;

  constructor(fetchParams?: BatchLink.Options) {
    super();

    const {
      batchInterval = 10,
      batchMax = 0,
      batchHandler = () => null,
      batchKey = () => '',
    } = fetchParams || {};

    this.batcher = new OperationBatcher({
      batchInterval,
      batchMax,
      batchHandler,
      batchKey,
    });

    //make this link terminating
    if (fetchParams!.batchHandler!.length <= 1) {
      this.request = operation => this.batcher.enqueueRequest({ operation });
    }
  }

  public request(
    operation: Operation,
    forward?: NextLink,
  ): Observable<FetchResult> | null {
    return this.batcher.enqueueRequest({
      operation,
      forward,
    });
  }
}
