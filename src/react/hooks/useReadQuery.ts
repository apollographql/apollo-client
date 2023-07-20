import * as React from "react";
import invariant from "ts-invariant";
import { NetworkStatus } from "../../core/index.js";
import { QUERY_REFERENCE_SYMBOL, type QueryReference } from "../cache/QueryReference.js";
import { __use } from "./internal/index.js";
import { toApolloError } from "./useSuspenseQuery.js";

export function useReadQuery<TData>(queryRef: QueryReference<TData>) {
  const [, forceUpdate] = React.useState(0);
  const internalQueryRef = queryRef[QUERY_REFERENCE_SYMBOL];
  invariant(
    internalQueryRef.promiseCache,
    'It appears that `useReadQuery` was used outside of `useInteractiveQuery`. ' +
      '`useReadQuery` is only supported for use with `useInteractiveQuery`. ' +
      'Please ensure you are passing the `queryRef` returned from `useInteractiveQuery`.'
  );

  const skipResult = React.useMemo(() => {
    const error = toApolloError(internalQueryRef.result);

    return {
      loading: false,
      data: internalQueryRef.result.data,
      networkStatus: error ? NetworkStatus.error : NetworkStatus.ready,
      error,
    };
  }, [internalQueryRef.result]);

  let promise = internalQueryRef.promiseCache.get(internalQueryRef.key);

  if (!promise) {
    promise = internalQueryRef.promise;
    internalQueryRef.promiseCache.set(internalQueryRef.key, promise);
  }

  React.useEffect(() => {
    return internalQueryRef.listen((promise) => {
      internalQueryRef.promiseCache!.set(internalQueryRef.key, promise);
      forceUpdate((prevState) => prevState + 1);
    });
  }, [queryRef]);

  const result =
    internalQueryRef.watchQueryOptions.fetchPolicy === 'standby'
      ? skipResult
      : __use(promise);

  return React.useMemo(() => {
    return {
      data: result.data,
      networkStatus: result.networkStatus,
      error: toApolloError(result),
    };
  }, [result]);
}
