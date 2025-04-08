const _WeakRef =
  typeof WeakRef !== "undefined" ? WeakRef : (
    (function <T>(value: T) {
      return { deref: () => value } satisfies Omit<
        WeakRef<any>,
        typeof Symbol.toStringTag
      >;
    } as any as typeof WeakRef)
  );

type CleanupFn = () => void;

/**
 * A function to create a "weak subscription", meaning that once the
 * `target` is garbage collected, on the next call to the callback, the
 * subscription will be cleaned up.
 * `callback` should be a function that is defined as a top-level function
 * to avoid that it closes any scope over `target` - instead, `target` will
 * be passed as the first argument to the callback.
 * `subscribe` can be defined in-place and it's okay if it closes over values.
 */
export function subscribeWeak<T extends object, Args extends any[]>(
  target: T,
  callback: (target: T, ...args: Args) => void,
  subscribe: (wrappedCallback: (...args: Args) => void) => CleanupFn
): CleanupFn {
  const [cleanupRef, cleanupFn] = getCleanupRef();
  const wrappedCallback = wrapCallback(
    new _WeakRef(target),
    callback,
    cleanupFn
  );
  cleanupRef.current = subscribe(wrappedCallback);
  return cleanupFn;
}

function getCleanupRef() {
  const cleanupRef: { current?: CleanupFn } = {};
  function cleanupFn() {
    cleanupRef.current?.();
    delete cleanupRef.current;
  }
  return [cleanupRef, cleanupFn] as const;
}

function wrapCallback<T extends object, Args extends any[]>(
  ref: WeakRef<T>,
  callback: (target: T, ...args: Args) => void,
  cleanupFn: CleanupFn
) {
  return (...args: Args) => {
    const target = ref.deref();
    if (target) {
      callback(target, ...args);
    } else {
      cleanupFn();
    }
  };
}
