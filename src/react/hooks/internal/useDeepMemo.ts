import { equal } from "@wry/equality";
import type { DependencyList } from "react";
import * as React from "react";

export function useDeepMemo<TValue>(
  memoFn: () => TValue,
  deps: DependencyList
) {
  const ref = React.useRef<{ deps: DependencyList; value: TValue }>(void 0);
  // eslint-disable-next-line react-compiler/react-compiler
  if (!ref.current || !equal(ref.current.deps, deps)) {
    // eslint-disable-next-line react-compiler/react-compiler
    ref.current = { value: memoFn(), deps };
  }
  // eslint-disable-next-line react-compiler/react-compiler
  return ref.current.value;
}
