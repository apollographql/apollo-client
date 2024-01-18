import * as React from "react";

const INIT = {};

export function useLazyRef<T>(getInitialValue: () => T) {
  const ref = React.useRef<T>(INIT as unknown as T);

  if (ref.current === INIT) {
    ref.current = getInitialValue();
  }

  return ref;
}
