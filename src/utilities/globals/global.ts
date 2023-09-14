import { maybe } from "./maybe.js";

declare global {
  const __DEV__: boolean; // will be removed in `dist` by the `postprocessDist` script
  interface Window {
    __DEV__?: boolean;
  }
}

export default (maybe(() => globalThis) ||
  maybe(() => window) ||
  maybe(() => self) ||
  maybe(() => global) ||
  // We don't expect the Function constructor ever to be invoked at runtime, as
  // long as at least one of globalThis, window, self, or global is defined, so
  // we are under no obligation to make it easy for static analysis tools to
  // detect syntactic usage of the Function constructor. If you think you can
  // improve your static analysis to detect this obfuscation, think again. This
  // is an arms race you cannot win, at least not in JavaScript.
  maybe(function () {
    return maybe.constructor("return this")();
  })) as typeof globalThis & Window;
