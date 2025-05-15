/** @internal */
export interface PendingPromise<TValue> extends Promise<TValue> {
  status: "pending";
}
