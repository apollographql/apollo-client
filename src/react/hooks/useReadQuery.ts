import * as React from "react";
import { unwrapQueryRef } from "../cache/QueryReference.js";
import type { QueryReference } from "../cache/QueryReference.js";
import { __use } from "./internal/index.js";
import { toApolloError } from "./useSuspenseQuery.js";
import { invariant } from "../../utilities/globals/index.js";
import { useSyncExternalStore } from "./useSyncExternalStore.js";
import type { ApolloError } from "../../errors/index.js";
import type { NetworkStatus } from "../../core/index.js";

export interface UseReadQueryResult<TData = unknown> {
  data: TData;
  error: ApolloError | undefined;
  networkStatus: NetworkStatus;
}

export function useReadQuery<TData>(
  queryRef: QueryReference<TData>
): UseReadQueryResult<TData> {
  const internalQueryRef = unwrapQueryRef(queryRef);
  invariant(
    internalQueryRef.promiseCache,
    "It appears that `useReadQuery` was used outside of `useBackgroundQuery`. " +
      "`useReadQuery` is only supported for use with `useBackgroundQuery`. " +
      "Please ensure you are passing the `queryRef` returned from `useBackgroundQuery`."
  );

  const { promiseCache, key } = internalQueryRef;

  if (!promiseCache.has(key)) {
    promiseCache.set(key, internalQueryRef.promise);
  }

  const promise = useSyncExternalStore(
    React.useCallback(
      (forceUpdate) => {
        return internalQueryRef.listen((promise) => {
          internalQueryRef.promiseCache!.set(internalQueryRef.key, promise);
          forceUpdate();
        });
      },
      [internalQueryRef]
    ),
    () => promiseCache.get(key)!,
    () => promiseCache.get(key)!
  );

  const result = __use(promise);

  return React.useMemo(() => {
    return {
      data: result.data,
      networkStatus: result.networkStatus,
      error: toApolloError(result),
    };
  }, [result]);
}
