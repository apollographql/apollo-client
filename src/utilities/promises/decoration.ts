import type {
  DecoratedPromise,
  FulfilledPromise,
  PendingPromise,
  RejectedPromise,
} from "@apollo/client/utilities/internal";

function isDecoratedPromise<TValue>(
  promise: Promise<TValue>
): promise is DecoratedPromise<TValue> {
  return "status" in promise;
}

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
