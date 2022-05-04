import { maybe } from "../globals";

export const canUseWeakMap =
  typeof WeakMap === 'function' &&
  maybe(() => navigator.product) !== 'ReactNative';

export const canUseWeakSet = typeof WeakSet === 'function';

export const canUseSymbol =
  typeof Symbol === 'function' &&
  typeof Symbol.for === 'function';

const isNode = !!maybe(() => `v${process.versions.node}` === process.version);

export const canUseDOM =
  !isNode &&
  typeof maybe(() => window.document.createElement) === "function";
