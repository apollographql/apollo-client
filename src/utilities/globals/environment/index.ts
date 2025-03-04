import { setVerbosity } from "ts-invariant";

declare const globalThis: { __DEV__?: boolean };

export const __DEV__ = (() => {
  // side effects in an IIFE
  const __DEV__: boolean = globalThis.__DEV__ !== false;
  setVerbosity(__DEV__ ? "log" : "silent");
  return __DEV__;
})();
