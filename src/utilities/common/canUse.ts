export const canUseWeakMap = typeof WeakMap === 'function' && !(
  typeof navigator === 'object' &&
  navigator.product === 'ReactNative'
);

export const canUseWeakSet = typeof WeakSet === 'function';

export const canUseSymbol =
  typeof Symbol === 'function' &&
  typeof Symbol.for === 'function';
