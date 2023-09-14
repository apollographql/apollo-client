export interface PendingPromise<TValue> extends Promise<TValue> {
  status: "pending";
}

export interface FulfilledPromise<TValue> extends Promise<TValue> {
  status: "fulfilled";
  value: TValue;
}

export interface RejectedPromise<TValue> extends Promise<TValue> {
  status: "rejected";
  reason: unknown;
}

export type PromiseWithState<TValue> =
  | PendingPromise<TValue>
  | FulfilledPromise<TValue>
  | RejectedPromise<TValue>;

export function createFulfilledPromise<TValue>(value: TValue) {
  const promise = Promise.resolve(value) as FulfilledPromise<TValue>;

  promise.status = "fulfilled";
  promise.value = value;

  return promise;
}

export function createRejectedPromise<TValue = unknown>(reason: unknown) {
  const promise = Promise.reject(reason) as RejectedPromise<TValue>;

  // prevent potential edge cases leaking unhandled error rejections
  promise.catch(() => {});

  promise.status = "rejected";
  promise.reason = reason;

  return promise;
}

export function isStatefulPromise<TValue>(
  promise: Promise<TValue>
): promise is PromiseWithState<TValue> {
  return "status" in promise;
}

export function wrapPromiseWithState<TValue>(
  promise: Promise<TValue>
): PromiseWithState<TValue> {
  if (isStatefulPromise(promise)) {
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

  return promise as PromiseWithState<TValue>;
}
