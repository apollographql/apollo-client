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

  export type BatchHandler = (
    operations: ApolloLink.Operation[],
    forward: ApolloLink.ForwardFunction[]
  ) => Observable<ApolloLink.Result[]>;

  export interface Options extends Shared.Options {
    /**
     * The handler that should execute a batch of operations.
     */
    batchHandler?: BatchLink.BatchHandler;

    /** {@inheritDoc @apollo/client/link/batch!BatchLink.Shared.Options#batchMax:member {"defaultValue": 0}} */
    batchMax?: number;
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
      batchHandler = () => EMPTY,
      batchKey = () => "",
    } = fetchParams || {};

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
