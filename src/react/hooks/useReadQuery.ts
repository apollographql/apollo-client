import * as React from "rehackt";
import {
  unwrapQueryRef,
  updateWrappedQueryRef,
} from "../cache/QueryReference.js";
import type { QueryReference } from "../cache/QueryReference.js";
import { __use } from "./internal/index.js";
import { toApolloError } from "./useSuspenseQuery.js";
import { useSyncExternalStore } from "./useSyncExternalStore.js";
import type { ApolloError } from "../../errors/index.js";
import type { NetworkStatus } from "../../core/index.js";
import { invariant } from "../../utilities/globals/index.js";

export interface UseReadQueryResult<TData = unknown> {
  /**
   * An object containing the result of your GraphQL query after it completes.
   *
   * This value might be `undefined` if a query results in one or more errors
   * (depending on the query's `errorPolicy`).
   */
  data: TData;
  /**
   * If the query produces one or more errors, this object contains either an
   * array of `graphQLErrors` or a single `networkError`. Otherwise, this value
   * is `undefined`.
   *
   * This property can be ignored when using the default `errorPolicy` or an
   * `errorPolicy` of `none`. The hook will throw the error instead of setting
   * this property.
   */
  error: ApolloError | undefined;
  /**
   * A number indicating the current network state of the query's associated
   * request. {@link https://github.com/apollographql/apollo-client/blob/d96f4578f89b933c281bb775a39503f6cdb59ee8/src/core/networkStatus.ts#L4 | See possible values}.
   */
  networkStatus: NetworkStatus;
}

export function useReadQuery<TData>(
  queryRef: QueryReference<TData>
): UseReadQueryResult<TData> {
  const internalQueryRef = React.useMemo(
    () => unwrapQueryRef(queryRef),
    [queryRef]
  );

  React.useEffect(() => internalQueryRef.retain(), [internalQueryRef]);

  if (__DEV__) {
    const didWarnOnDisposedQueryRef = React.useRef<unknown>(void 0);
    if (
      didWarnOnDisposedQueryRef.current !== internalQueryRef &&
      internalQueryRef.disposed
    ) {
      invariant.warn(`'useReadQuery' was called with a disposed queryRef which means the query is no longer watched and cache updates will be missed.

This occurs when calling 'dispose' while 'useReadQuery' is still mounted, either by calling 'dispose' too early, or because you are using React's strict mode and calling 'dispose' in a 'useEffect' cleanup function.

If you're using a queryRef produced by 'useBackgroundQuery' or 'useLoadableQuery', this is a bug in Apollo Client. Please file an issue.`);
      didWarnOnDisposedQueryRef.current = internalQueryRef;
    }
  }

  const promise = useSyncExternalStore(
    React.useCallback(
      (forceUpdate) => {
        return internalQueryRef.listen((promise) => {
          updateWrappedQueryRef(queryRef, promise);
          forceUpdate();
        });
      },
      [internalQueryRef]
    ),
    () => queryRef.toPromise(),
    () => queryRef.toPromise()
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
