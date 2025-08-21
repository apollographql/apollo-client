import { equal } from "@wry/equality";
import type { DependencyList } from "react";
import * as React from "react";

export function useDeepMemo<TValue>(
  memoFn: () => TValue,
  deps: DependencyList
) {
  const ref = React.useRef<{ deps: DependencyList; value: TValue }>(void 0);
  if (!ref.current || !equal(ref.current.deps, deps)) {
    ref.current = { value: memoFn(), deps };
  }
  return ref.current.value;
}
