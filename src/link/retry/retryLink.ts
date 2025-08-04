import type { Subscription } from "rxjs";
import type { Observer } from "rxjs";
import { Observable } from "rxjs";

import type { ErrorLike } from "@apollo/client";
import {
  graphQLResultHasProtocolErrors,
  PROTOCOL_ERRORS_SYMBOL,
  toErrorLike,
} from "@apollo/client/errors";
import { ApolloLink } from "@apollo/client/link";

import { buildDelayFunction } from "./delayFunction.js";
import { buildRetryFunction } from "./retryFunction.js";

export declare namespace RetryLink {
  export type DelayFunction = (
    count: number,
    operation: ApolloLink.Operation,
    error: ErrorLike
  ) => number;

  export interface DelayOptions {
    /**
     * The number of milliseconds to wait before attempting the first retry.
     *
     * Delays will increase exponentially for each attempt. E.g. if this is
     * set to 100, subsequent retries will be delayed by 200, 400, 800, etc,
     * until they reach maxDelay.
     *
     * Note that if jittering is enabled, this is the _average_ delay.
     *
     * @defaultValue `300`
     */
    initial?: number;

    /**
     * The maximum number of milliseconds that the link should wait for any
     * retry.
     *
     * @defaultValue `Infinity`
     */
    max?: number;

    /**
     * Whether delays between attempts should be randomized.
     *
     * This helps avoid thundering herd type situations by better distributing
     * load during major outages.
     *
     * @defaultValue `true`
     */
    jitter?: boolean;
  }

  export type AttemptsFunction = (
    count: number,
    operation: ApolloLink.Operation,
    error: ErrorLike
  ) => boolean | Promise<boolean>;

  export interface AttemptsOptions {
    /**
     * The max number of times to try a single operation before giving up. Pass
     * `Infinity` for infinite retries.
     *
     * Note that this INCLUDES the initial request as part of the count.
     * E.g. maxTries of 1 indicates no retrying should occur.
     *
     * @defaultValue `5`
     */
    max?: number;

    /**
     * Predicate function that determines whether a particular error should
     * trigger a retry.
     *
     * For example, you may want to not retry 4xx class HTTP errors.
     *
     * @defaultValue `() => true`
     */
    retryIf?: (
      error: ErrorLike,
      operation: ApolloLink.Operation
    ) => boolean | Promise<boolean>;
  }

  /**
   * Options provided to the `RetryLink` constructor.
   */
  export interface Options {
    /**
     * Configuration for the delay strategy to use, or a custom delay strategy.
     */
    delay?: RetryLink.DelayOptions | RetryLink.DelayFunction;

    /**
     * Configuration for the retry strategy to use, or a custom retry strategy.
     */
    attempts?: RetryLink.AttemptsOptions | RetryLink.AttemptsFunction;
  }
}

/**
 * Tracking and management of operations that may be (or currently are) retried.
 */
class RetryableOperation {
  private retryCount: number = 0;
  private currentSubscription: Subscription | null = null;
  private timerId: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private observer: Observer<ApolloLink.Result>,
    private operation: ApolloLink.Operation,
    private forward: ApolloLink.ForwardFunction,
    private delayFor: RetryLink.DelayFunction,
    private retryIf: RetryLink.AttemptsFunction
  ) {
    this.try();
  }

  /**
   * Stop retrying for the operation, and cancel any in-progress requests.
   */
  public cancel() {
    if (this.currentSubscription) {
      this.currentSubscription.unsubscribe();
    }
    clearTimeout(this.timerId);
    this.timerId = undefined;
    this.currentSubscription = null;
  }

  private try() {
    this.currentSubscription = this.forward(this.operation).subscribe({
      next: (result) => {
        if (graphQLResultHasProtocolErrors(result)) {
          this.onError(result.extensions[PROTOCOL_ERRORS_SYMBOL], () =>
            // Pretend like we never encountered this error and move the result
            // along for Apollo Client core to handle this error.
            this.observer.next(result)
          );
          // Unsubscribe from the current subscription to prevent the `complete`
          // handler to be called as a result of the stream closing.
          this.currentSubscription?.unsubscribe();
          return;
        }

        this.observer.next(result);
      },
      error: (error) => this.onError(error, () => this.observer.error(error)),
      complete: this.observer.complete.bind(this.observer),
    });
  }

  private onError = async (error: unknown, onContinue: () => void) => {
    this.retryCount += 1;
    const errorLike = toErrorLike(error);

    const shouldRetry = await this.retryIf(
      this.retryCount,
      this.operation,
      errorLike
    );
    if (shouldRetry) {
      this.scheduleRetry(
        this.delayFor(this.retryCount, this.operation, errorLike)
      );
      return;
    }

    onContinue();
  };

  private scheduleRetry(delay: number) {
    if (this.timerId) {
      throw new Error(`RetryLink BUG! Encountered overlapping retries`);
    }

    this.timerId = setTimeout(() => {
      this.timerId = undefined;
      this.try();
    }, delay);
  }
}

/**
 * `RetryLink` is a non-terminating link that attempts to retry operations that
 * fail due to network errors. It enables resilient GraphQL operations by
 * automatically retrying failed requests with configurable delay and retry
 * strategies.
 *
 * @remarks
 *
 * `RetryLink` is particularly useful for handling unreliable network conditions
 * where you would rather wait longer than explicitly fail an operation. It
 * provides exponential backoff and jitters delays between attempts by default.
 *
 * > [!NOTE]
 * > This link does not handle retries for GraphQL errors in the response. Use
 * > `ErrorLink` to retry an operation after a GraphQL error. For more
 * > information, see the [Error handling documentation](https://apollographql.com/docs/react/data/error-handling#on-graphql-errors).
 *
 * @example
 *
 * ```ts
 * import { RetryLink } from "@apollo/client/link/retry";
 *
 * const link = new RetryLink();
 * ```
 */
export class RetryLink extends ApolloLink {
  private delayFor: RetryLink.DelayFunction;
  private retryIf: RetryLink.AttemptsFunction;

  constructor(options?: RetryLink.Options) {
    super();
    const { attempts, delay } = options || ({} as RetryLink.Options);
    this.delayFor =
      typeof delay === "function" ? delay : buildDelayFunction(delay);
    this.retryIf =
      typeof attempts === "function" ? attempts : buildRetryFunction(attempts);
  }

  public request(
    operation: ApolloLink.Operation,
    forward: ApolloLink.ForwardFunction
  ): Observable<ApolloLink.Result> {
    return new Observable((observer) => {
      const retryable = new RetryableOperation(
        observer,
        operation,
        forward,
        this.delayFor,
        this.retryIf
      );
      return () => {
        retryable.cancel();
      };
    });
  }
}
