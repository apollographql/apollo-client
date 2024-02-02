import React from "rehackt";

/**
 * A hook that provides a stable reference to a function without suffering from
 * stale closures. Useful to get a stable function reference for callback
 * function options in other hooks. This avoids the need for the user to wrap
 * each callback in a `useCallback`.
 *
 * @param unstableCallback - A callback function
 */
export function useStableCallback<TArgs extends unknown[], TReturn>(
  unstableCallback: (...args: TArgs) => TReturn
) {
  const callbackRef = React.useRef(unstableCallback);

  React.useLayoutEffect(() => {
    callbackRef.current = unstableCallback;
  });

  return React.useCallback((...args: TArgs): TReturn => {
    const fn = callbackRef.current;
    return fn(...args);
  }, []);
}
