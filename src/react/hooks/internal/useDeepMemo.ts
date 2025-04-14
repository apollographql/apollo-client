import type { DependencyList } from "react";
import * as React from "rehackt";
import { equal } from "@wry/equality";

export function useDeepMemo<TValue>(
  memoFn: () => TValue,
  deps: DependencyList
) {
  const ref = React.useRef<{ deps: DependencyList; value: TValue }>(void 0);

  if (!ref.current || !equal(ref.current.deps, deps)) {
    // eslint-disable-next-line react-compiler/react-compiler
    ref.current = { value: memoFn(), deps };
  }

  return ref.current.value;
}
