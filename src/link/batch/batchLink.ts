import type { Operation, FetchResult, NextLink } from "../core/index.js";
import { ApolloLink } from "../core/index.js";
import type { Observable } from "../../utilities/index.js";
import type { BatchHandler } from "./batching.js";
import { OperationBatcher } from "./batching.js";
export type { BatchableRequest, BatchHandler } from "./batching.js";
export { OperationBatcher } from "./batching.js";

export namespace BatchLink {
  export interface Options {
    /**
     * The interval at which to batch, in milliseconds.
     *
     * Defaults to 10.
     */
    batchInterval?: number;

    /**
     * "batchInterval" is a throttling behavior by default, if you instead wish
     * to debounce outbound requests, set "batchDebounce" to true. More useful
     * for mutations than queries.
     */
    batchDebounce?: boolean;

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
      batchDebounce,
      batchInterval = 10,
      batchMax = 0,
      batchHandler = () => null,
      batchKey = () => "",
    } = fetchParams || {};

    this.batcher = new OperationBatcher({
      batchDebounce,
      batchInterval,
      batchMax,
      batchHandler,
      batchKey,
    });

    //make this link terminating
    if (fetchParams!.batchHandler!.length <= 1) {
      this.request = (operation) => this.batcher.enqueueRequest({ operation });
    }
  }

  public request(
    operation: Operation,
    forward?: NextLink
  ): Observable<FetchResult> | null {
    return this.batcher.enqueueRequest({
      operation,
      forward,
    });
  }
}
