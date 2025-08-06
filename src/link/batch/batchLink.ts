import type { Observable } from "rxjs";
import { EMPTY } from "rxjs";

import { ApolloLink } from "@apollo/client/link";

import { OperationBatcher } from "./batching.js";

export declare namespace BatchLink {
  export namespace Shared {
    /** These options are shared between `BatchLink` and `BatchHttpLink` */
    interface Options {
      /**
       * The interval at which to batch, in milliseconds.
       *
       * @defaultValue 10
       */
      batchInterval?: number;

      /**
       * "batchInterval" is a throttling behavior by default, if you instead wish
       * to debounce outbound requests, set "batchDebounce" to true. More useful
       * for mutations than queries.
       */
      batchDebounce?: boolean;

      /**
       * The maximum number of operations to include in a single batch.
       *
       * @defaultValue \{\{defaultValue\}\}
       */
      batchMax?: number;

      /**
       * Creates the key for a batch
       */
      batchKey?: (operation: ApolloLink.Operation) => string;
    }
  }

  /**
   * Function type for handling a batch of GraphQL operations.
   *
   * @remarks
   *
   * The batch handler is responsible for processing multiple operations together
   * and returning their results. Each operation has a corresponding forward function
   * that can be used to continue processing down the link chain.
   *
   * Results must be returned in the same order as the input operations to ensure
   * proper correlation with the original requests.
   *
   * @param operations - Array of GraphQL operations to process
   * @param forward - Array of forward functions, one per operation
   * @returns Observable that emits an array of results in the same order as operations
   */
  export type BatchHandler = (
    operations: ApolloLink.Operation[],
    forward: ApolloLink.ForwardFunction[]
  ) => Observable<ApolloLink.Result[]>;

  /**
   * Configuration options for creating a `BatchLink` instance.
   *
   * @remarks
   *
   * `BatchLink` options control how operations are grouped into batches
   * and when those batches are processed. The `batchHandler` function
   * is responsible for actually processing the batched operations.
   *
   * Most batching behavior is configured through timing options:
   *
   * - `batchInterval`: How long to wait before processing a batch
   * - `batchDebounce`: Whether to reset the timer on new operations
   * - `batchMax`: Maximum operations per batch (0 = unlimited)
   *
   * Custom grouping logic can be implemented via `batchKey` function.
   */
  export interface Options extends Shared.Options {
    /**
     * The handler that executes a batch of operations.
     *
     * @remarks
     *
     * This function receives an array of operations and their corresponding
     * forward functions, and should return an Observable that emits the results
     * for all operations in the batch.
     */
    batchHandler?: BatchLink.BatchHandler;

    /** {@inheritDoc @apollo/client/link/batch!BatchLink.Shared.Options#batchMax:member {"defaultValue": 0}} */
    batchMax?: number;
  }
}

/**
 * `BatchLink` is a non-terminating link that provides the core batching
 * functionality for grouping multiple GraphQL operations into batches based
 * on configurable timing and key-based grouping strategies. It serves as a base
 * link to `BatchHttpLink`.
 *
 * @remarks
 *
 * > [!NOTE]
 * > You will not generally use `BatchLink` on your own unless you need to
 * > provide batching capabilities to third-party terminating links. Prefer
 * > using `BatchHttpLink` to batch GraphQL operations over HTTP.
 *
 * @example
 *
 * ```ts
 * import { BatchLink } from "@apollo/client/link/batch";
 *
 * const link = new BatchLink({
 *   batchInterval: 20,
 *   batchMax: 5,
 *   batchHandler: (operations, forwards) => {
 *     // Custom logic to process batch of operations
 *     return handleBatch(operations, forwards);
 *   },
 * });
 * ```
 */
export class BatchLink extends ApolloLink {
  private batcher: OperationBatcher;

  constructor(options?: BatchLink.Options) {
    super();

    const {
      batchDebounce,
      batchInterval = 10,
      batchMax = 0,
      batchHandler = () => EMPTY,
      batchKey = () => "",
    } = options || {};

    this.batcher = new OperationBatcher({
      batchDebounce,
      batchInterval,
      batchMax,
      batchHandler,
      batchKey,
    });
  }

  public request(
    operation: ApolloLink.Operation,
    forward: ApolloLink.ForwardFunction
  ): Observable<ApolloLink.Result> {
    return this.batcher.enqueueRequest({ operation, forward });
  }
}
