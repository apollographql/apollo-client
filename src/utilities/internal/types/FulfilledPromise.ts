/** @internal */
export interface FulfilledPromise<TValue> extends Promise<TValue> {
  status: "fulfilled";
  value: TValue;
}
