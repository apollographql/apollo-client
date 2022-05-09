import { maybe } from "../globals";

export const canUseWeakMap =
  typeof WeakMap === 'function' &&
  maybe(() => navigator.product) !== 'ReactNative';

export const canUseWeakSet = typeof WeakSet === 'function';

export const canUseSymbol =
  typeof Symbol === 'function' &&
  typeof Symbol.for === 'function';

export const canUseDOM =
  typeof maybe(() => window.document.createElement) === "function";

const usingJSDOM: boolean =
  // Following advice found in this comment from @domenic (maintainer of jsdom):
  // https://github.com/jsdom/jsdom/issues/1537#issuecomment-229405327
  //
  // Since we control the version of Jest and jsdom used when running Apollo
  // Client tests, and that version is recent enought to include " jsdom/x.y.z"
  // at the end of the user agent string, I believe this case is all we need to
  // check. Testing for "Node.js" was recommended for backwards compatibility
  // with older version of jsdom, but we don't have that problem.
  maybe(() => navigator.userAgent.indexOf("jsdom") >= 0) || false;

// Our tests should all continue to pass if we remove this !usingJSDOM
// condition, thereby allowing useLayoutEffect when using jsdom. Unfortunately,
// if we allow useLayoutEffect, then useSyncExternalStore generates many
// warnings about useLayoutEffect doing nothing on the server. While these
// warnings are harmless, this !usingJSDOM condition seems to be the best way to
// prevent them (i.e. skipping useLayoutEffect when using jsdom).
export const canUseLayoutEffect = canUseDOM && !usingJSDOM;
