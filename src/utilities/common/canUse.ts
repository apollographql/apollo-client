import { maybe } from "../globals";

export const canUseWeakMap =
  typeof WeakMap === 'function' &&
  maybe(() => navigator.product) !== 'ReactNative';

export const canUseWeakSet = typeof WeakSet === 'function';

export const canUseSymbol =
  typeof Symbol === 'function' &&
  typeof Symbol.for === 'function';

const usingJSDOM: boolean =
  // Following advice found in this comment from @domenic (maintainer of jsdom):
  // https://github.com/jsdom/jsdom/issues/1537#issuecomment-229405327. Since we
  // control the version of Jest used when running Apollo Client tests, and that
  // version includes jsdom/x.y.z at the end of the user agent string, I believe
  // this case is all we need to test for.
  maybe(() => navigator.userAgent.indexOf("jsdom") >= 0) || false;

export const canUseDOM =
  // Our tests should all continue to pass if we remove the !usingJSDOM
  // condition, thereby allowing canUseDOM to be true when using jsdom.
  // Unfortunately, if we allow that, then useSyncExternalStore generates a lot
  // of warnings about useLayoutEffect doing nothing on the server. While these
  // warnings are harmless, this !usingJSDOM condition seems to be the best way
  // to prevent them (i.e. skipping useLayoutEffect when using jsdom).
  !usingJSDOM &&
  typeof maybe(() => window.document.createElement) === "function";
