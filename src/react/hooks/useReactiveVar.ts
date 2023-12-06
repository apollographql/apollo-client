import * as React from "rehackt";
import type { ReactiveVar } from "../../core/index.js";
import { useSyncExternalStore } from "./useSyncExternalStore.js";

export function useReactiveVar<T>(rv: ReactiveVar<T>): T {
  return useSyncExternalStore(
    React.useCallback(
      (update) => {
        // By reusing the same onNext function in the nested call to
        // rv.onNextChange(onNext), we can keep using the initial clean-up function
        // returned by rv.onNextChange(function onNext(v){...}), without having to
        // register the new clean-up function (returned by the nested
        // rv.onNextChange(onNext)) with yet another callback.
        return rv.onNextChange(function onNext() {
          update();
          rv.onNextChange(onNext);
        });
      },
      [rv]
    ),
    rv,
    rv
  );
}
