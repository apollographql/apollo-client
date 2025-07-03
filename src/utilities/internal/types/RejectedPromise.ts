/** @internal */
export interface RejectedPromise<TValue> extends Promise<TValue> {
  status: "rejected";
  reason: unknown;
}
