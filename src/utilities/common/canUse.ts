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
