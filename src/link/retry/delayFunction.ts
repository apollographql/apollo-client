import type { RetryLink } from "./retryLink.js";

export function buildDelayFunction(
  delayOptions?: RetryLink.DelayOptions
): RetryLink.DelayFunction {
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
