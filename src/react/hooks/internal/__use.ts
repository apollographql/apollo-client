import { wrapPromiseWithState } from "../../../utilities/index.js";
import * as React from "rehackt";

type Use = <T>(promise: Promise<T>) => T;
// Prevent webpack from complaining about our feature detection of the
// use property of the React namespace, which is expected not
// to exist when using current stable versions, and that's fine.
const useKey = "use" as keyof typeof React;
const realHook = React[useKey] as Use | undefined;

// This is named with two underscores to allow this hook to evade typical rules of
// hooks (i.e. it can be used conditionally)
export const __use =
  realHook ||
  function __use<TValue>(promise: Promise<TValue>) {
    const statefulPromise = wrapPromiseWithState(promise);

    switch (statefulPromise.status) {
      case "pending":
        throw statefulPromise;
      case "rejected":
        throw statefulPromise.reason;
      case "fulfilled":
        return statefulPromise.value;
    }
  };
