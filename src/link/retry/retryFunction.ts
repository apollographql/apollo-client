import type { Operation } from "../core/index.js";

/**
 * Advanced mode: a function that determines both whether a particular
 * response should be retried.
 */
export interface RetryFunction {
  (count: number, operation: Operation, error: any): boolean | Promise<boolean>;
}

export interface RetryFunctionOptions {
  /**
   * The max number of times to try a single operation before giving up.
   *
   * Note that this INCLUDES the initial request as part of the count.
   * E.g. maxTries of 1 indicates no retrying should occur.
   *
   * Defaults to 5.  Pass Infinity for infinite retries.
   */
  max?: number;

  /**
   * Predicate function that determines whether a particular error should
   * trigger a retry.
   *
   * For example, you may want to not retry 4xx class HTTP errors.
   *
   * By default, all errors are retried.
   */
  retryIf?: (error: any, operation: Operation) => boolean | Promise<boolean>;
}

export function buildRetryFunction(
  retryOptions?: RetryFunctionOptions
): RetryFunction {
  const { retryIf, max = 5 } = retryOptions || ({} as RetryFunctionOptions);
  return function retryFunction(count, operation, error) {
    if (count >= max) return false;
    return retryIf ? retryIf(error, operation) : !!error;
  };
}
