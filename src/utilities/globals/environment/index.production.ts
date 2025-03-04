import { setVerbosity } from "ts-invariant";

export const __DEV__ = (() => {
  // side effects in an IIFE
  setVerbosity("silent");
  return false as boolean;
})();
