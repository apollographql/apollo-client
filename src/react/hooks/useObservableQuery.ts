import { useRef, useEffect } from "react";
import { invariant } from "ts-invariant";
import equal from "@wry/equality";

import {
  ApolloQueryResult,
  mergeOptions,
  ObservableQuery,
  WatchQueryOptions,
} from "../../core";
import { cloneDeep, Observer } from "../../utilities";
import { useApolloClient } from "./useApolloClient";

function defaultErrorHandler(error: any) {
  invariant.error("in useObservableQuery default error handler:", error);
}

export function useObservableQuery<TData, TVars>(
  queryOrOptions:
    | ObservableQuery<TData, TVars>
    | WatchQueryOptions<TVars, TData>,
  observer?: Observer<ApolloQueryResult<TData>>,
): ObservableQuery<TData, TVars> {
  const client = useApolloClient();

  const oqOptionsRef = useRef<{
    oq: ObservableQuery<TData, TVars>;
    options: WatchQueryOptions<TVars, TData>;
  }>();

  const { oq, options } = oqOptionsRef.current ||
    (oqOptionsRef.current = queryOrOptions instanceof ObservableQuery ? {
      oq: queryOrOptions,
      options: queryOrOptions.options,
    } : {
      oq: client.watchQuery(queryOrOptions),
      // Store the initial options we passed to useObservableQuery, so we can
      // compare future queryOrOptions objects against those options, to decide
      // whether we need to call oq.setOptions in useEffect, below.
      options: cloneDeep(queryOrOptions),
    });

  useEffect(() => {
    if (
      !(queryOrOptions instanceof ObservableQuery) &&
      !equal(options, queryOrOptions)
    ) {
      // TODO Take the differences between options and queryOrOptions and merge
      // them into oq.options, somehow.
      oq.setOptions(mergeOptions(
        oq.options,
        oqOptionsRef.current!.options = queryOrOptions,
      ));
    }

    const sub = oq.subscribe({
      error: defaultErrorHandler,
      ...observer,
    });

    return () => sub.unsubscribe();
  }, [oq]);

  return oq;
}
