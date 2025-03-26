import * as React from "react";

import type { ObservableQuery, OperationVariables } from "@apollo/client/core";

import { useSyncExternalStore } from "../useSyncExternalStore.js";

export function useObservableQueryValue<
  TData,
  TVariables extends OperationVariables,
>(observable: ObservableQuery<TData, TVariables>) {
  const getValue = React.useCallback(
    () => observable.getCurrentResult(),
    [observable]
  );
  return useSyncExternalStore(
    React.useCallback(
      (update) => {
        const subscription = observable.subscribe({
          next: (value) => {
            if (value !== observable.getCurrentResult()) {
              update();
            }
          },
        });

        return () => {
          subscription.unsubscribe();
        };
      },
      [observable]
    ),
    getValue,
    getValue
  );
}
