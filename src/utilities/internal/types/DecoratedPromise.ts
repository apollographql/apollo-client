import type { FulfilledPromise } from "./FulfilledPromise.js";
import type { PendingPromise } from "./PendingPromise.js";
import type { RejectedPromise } from "./RejectedPromise.js";

/** @internal */
export type DecoratedPromise<TValue> =
  | PendingPromise<TValue>
  | FulfilledPromise<TValue>
  | RejectedPromise<TValue>;
