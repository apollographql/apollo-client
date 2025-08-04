import type { RetryLink } from "./retryLink.js";

export function buildRetryFunction(
  retryOptions?: RetryLink.AttemptsOptions
): RetryLink.AttemptsFunction {
  const { retryIf, max = 5 } =
    retryOptions || ({} as RetryLink.AttemptsOptions);
  return function retryFunction(count, operation, error) {
    if (count >= max) return false;
    return retryIf ? retryIf(error, operation) : !!error;
  };
}
