import type { Operation, FetchResult, NextLink } from "../core/index.js";
import { ApolloLink } from "../core/index.js";
import type { ObservableSubscription } from "../../utilities/index.js";
import { Observable } from "../../utilities/index.js";
import type { DelayFunction, DelayFunctionOptions } from "./delayFunction.js";
import { buildDelayFunction } from "./delayFunction.js";
import type { RetryFunction, RetryFunctionOptions } from "./retryFunction.js";
import { buildRetryFunction } from "./retryFunction.js";
import type { SubscriptionObserver } from "zen-observable-ts";

export namespace RetryLink {
  export interface Options {
    /**
     * Configuration for the delay strategy to use, or a custom delay strategy.
     */
    delay?: DelayFunctionOptions | DelayFunction;

    /**
     * Configuration for the retry strategy to use, or a custom retry strategy.
     */
    attempts?: RetryFunctionOptions | RetryFunction;
  }
}

/**
 * Tracking and management of operations that may be (or currently are) retried.
 */
class RetryableOperation {
  private retryCount: number = 0;
  private currentSubscription: ObservableSubscription | null = null;
  private timerId: number | undefined;

  constructor(
    private observer: SubscriptionObserver<FetchResult>,
    private operation: Operation,
    private forward: NextLink,
    private delayFor: DelayFunction,
    private retryIf: RetryFunction
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
      next: this.observer.next.bind(this.observer),
      error: this.onError,
      complete: this.observer.complete.bind(this.observer),
    });
  }

  private onError = async (error: any) => {
    this.retryCount += 1;

    // Should we retry?
    const shouldRetry = await this.retryIf(
      this.retryCount,
      this.operation,
      error
    );
    if (shouldRetry) {
      this.scheduleRetry(this.delayFor(this.retryCount, this.operation, error));
      return;
    }

    this.observer.error(error);
  };

  private scheduleRetry(delay: number) {
    if (this.timerId) {
      throw new Error(`RetryLink BUG! Encountered overlapping retries`);
    }

    this.timerId = setTimeout(() => {
      this.timerId = undefined;
      this.try();
    }, delay) as any as number;
  }
}

export class RetryLink extends ApolloLink {
  private delayFor: DelayFunction;
  private retryIf: RetryFunction;

  constructor(options?: RetryLink.Options) {
    super();
    const { attempts, delay } = options || ({} as RetryLink.Options);
    this.delayFor =
      typeof delay === "function" ? delay : buildDelayFunction(delay);
    this.retryIf =
      typeof attempts === "function" ? attempts : buildRetryFunction(attempts);
  }

  public request(
    operation: Operation,
    nextLink: NextLink
  ): Observable<FetchResult> {
    return new Observable((observer) => {
      const retryable = new RetryableOperation(
        observer,
        operation,
        nextLink,
        this.delayFor,
        this.retryIf
      );
      return () => {
        retryable.cancel();
      };
    });
  }
}
