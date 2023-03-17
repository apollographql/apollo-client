export interface PendingPromise<TValue> extends Promise<TValue> {
  status: 'pending';
}

export interface FulfilledPromise<TValue> extends Promise<TValue> {
  status: 'fulfilled';
  value: TValue;
}

export interface RejectedPromise<TValue> extends Promise<TValue> {
  status: 'rejected';
  reason: unknown;
}

export type PromiseWithState<TValue> =
  | PendingPromise<TValue>
  | FulfilledPromise<TValue>
  | RejectedPromise<TValue>;

export function isStatefulPromise<TValue>(
  promise: Promise<TValue>
): promise is PromiseWithState<TValue> {
  return 'status' in promise;
}

export function wrapPromiseWithState<TValue>(
  promise: Promise<TValue>
): PromiseWithState<TValue> {
  if (isStatefulPromise(promise)) {
    return promise;
  }

  (promise as PendingPromise<TValue>).status = 'pending';

  promise
    .then((value) => {
      (promise as FulfilledPromise<TValue>).status = 'fulfilled';
      (promise as FulfilledPromise<TValue>).value = value;
    })
    .catch((reason) => {
      (promise as RejectedPromise<TValue>).status = 'rejected';
      (promise as RejectedPromise<TValue>).reason = reason;
    });

  return promise as PromiseWithState<TValue>;
}
