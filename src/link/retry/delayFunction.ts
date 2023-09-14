import type { Operation } from "../core/index.js";

/**
 * Advanced mode: a function that implements the strategy for calculating delays
 * for particular responses.
 */
export interface DelayFunction {
  (count: number, operation: Operation, error: any): number;
}

export interface DelayFunctionOptions {
  /**
   * The number of milliseconds to wait before attempting the first retry.
   *
   * Delays will increase exponentially for each attempt.  E.g. if this is
   * set to 100, subsequent retries will be delayed by 200, 400, 800, etc,
   * until they reach maxDelay.
   *
   * Note that if jittering is enabled, this is the _average_ delay.
   *
   * Defaults to 300.
   */
  initial?: number;

  /**
   * The maximum number of milliseconds that the link should wait for any
   * retry.
   *
   * Defaults to Infinity.
   */
  max?: number;

  /**
   * Whether delays between attempts should be randomized.
   *
   * This helps avoid thundering herd type situations by better distributing
   * load during major outages.
   *
   * Defaults to true.
   */
  jitter?: boolean;
}

export function buildDelayFunction(
  delayOptions?: DelayFunctionOptions
): DelayFunction {
  const { initial = 300, jitter = true, max = Infinity } = delayOptions || {};
  // If we're jittering, baseDelay is half of the maximum delay for that
  // attempt (and is, on average, the delay we will encounter).
  // If we're not jittering, adjust baseDelay so that the first attempt
  // lines up with initialDelay, for everyone's sanity.
  const baseDelay = jitter ? initial : initial / 2;

  return function delayFunction(count: number) {
    let delay = Math.min(max, baseDelay * 2 ** count);
    if (jitter) {
      // We opt for a full jitter approach for a mostly uniform distribution,
      // but bound it within initialDelay and delay for everyone's sanity.
      delay = Math.random() * delay;
    }

    return delay;
  };
}
