import * as React from "react";

import type { ReactiveVar } from "@apollo/client";

import { useSyncExternalStore } from "./useSyncExternalStore.js";

/**
 * Reads the value of a [reactive variable](https://www.apollographql.com/docs/react/local-state/reactive-variables/) and re-renders the containing component whenever that variable's value changes. This enables a reactive variable to trigger changes _without_ relying on the `useQuery` hook.
 *
 * @example
 *
 * ```jsx
 * import { makeVar } from "@apollo/client";
 * import { useReactiveVar } from "@apollo/client/react";
 * export const cartItemsVar = makeVar([]);
 *
 * export function Cart() {
 *   const cartItems = useReactiveVar(cartItemsVar);
 *   // ...
 * }
 * ```
 *
 * @param rv - A reactive variable.
 * @returns The current value of the reactive variable.
 */
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
