import React from "rehackt";

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
