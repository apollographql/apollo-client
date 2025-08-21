import type { DecoratedPromise } from "./types/DecoratedPromise.js";
import type { FulfilledPromise } from "./types/FulfilledPromise.js";
import type { PendingPromise } from "./types/PendingPromise.js";
import type { RejectedPromise } from "./types/RejectedPromise.js";

function isDecoratedPromise<TValue>(
  promise: Promise<TValue>
): promise is DecoratedPromise<TValue> {
  return "status" in promise;
}

/** @internal */
export function decoratePromise<TValue>(
  promise: Promise<TValue>
): DecoratedPromise<TValue> {
  if (isDecoratedPromise(promise)) {
    return promise;
  }

  const pendingPromise = promise as PendingPromise<TValue>;
  pendingPromise.status = "pending";

  pendingPromise.then(
    (value) => {
      if (pendingPromise.status === "pending") {
        const fulfilledPromise =
          pendingPromise as unknown as FulfilledPromise<TValue>;

        fulfilledPromise.status = "fulfilled";
        fulfilledPromise.value = value;
      }
    },
    (reason: unknown) => {
      if (pendingPromise.status === "pending") {
        const rejectedPromise =
          pendingPromise as unknown as RejectedPromise<TValue>;

        rejectedPromise.status = "rejected";
        rejectedPromise.reason = reason;
      }
    }
  );

  return promise as DecoratedPromise<TValue>;
}
