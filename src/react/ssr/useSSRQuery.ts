import type { DocumentNode } from "graphql";

import type { ObservableQuery } from "@apollo/client";
import { NetworkStatus } from "@apollo/client";
import { useApolloClient, useQuery } from "@apollo/client/react";
import { maybeDeepFreeze } from "@apollo/client/utilities/internal";

import type { PrerenderStaticInternalContext } from "./prerenderStatic.js";

const skipStandbyResult: ObservableQuery.Result<any> = maybeDeepFreeze({
  loading: false,
  data: void 0 as any,
  dataState: "empty",
  error: void 0,
  networkStatus: NetworkStatus.ready,
  partial: true,
});

export const useSSRQuery = function (
  this: PrerenderStaticInternalContext,
  query: DocumentNode,
  options: useQuery.Options<any, any> = {}
): useQuery.Result<any, any> {
  function notAllowed(): never {
    throw new Error("This method cannot be called during SSR.");
  }
  const client = useApolloClient(options.client);

  const baseResult: Omit<
    useQuery.Result,
    "observable" | "data" | "error" | "loading" | "networkStatus" | "dataState"
  > = {
    client,
    refetch: notAllowed,
    fetchMore: notAllowed,
    subscribeToMore: notAllowed,
    updateQuery: notAllowed,
    startPolling: notAllowed,
    stopPolling: notAllowed,
    variables: options?.variables,
    previousData: undefined,
  };

  if (options.skip || options.fetchPolicy === "standby") {
    return withoutObservableAccess({
      ...baseResult,
      ...skipStandbyResult,
    });
  }
  if (options.ssr === false) {
    return withoutObservableAccess({
      ...baseResult,
      ...useQuery.ssrDisabledResult,
    });
  }

  let observable = this.getObservableQuery(query, options.variables);
  if (!observable) {
    observable = client.watchQuery({
      query,
      ...options,
      fetchPolicy:
        (
          options.fetchPolicy === "network-only" ||
          options.fetchPolicy === "cache-and-network"
        ) ?
          "cache-first"
        : options.fetchPolicy,
    });
    this.onCreatedObservableQuery(observable, query, options.variables);
  }
  return {
    observable,
    ...observable.getCurrentResult(),
    ...baseResult,
  };
};

function withoutObservableAccess<T>(
  value: T
): T & { observable: ObservableQuery<any, any> } {
  Object.defineProperty(value, "observable", {
    get() {
      throw new Error(
        '"observable" property is not accessible on skipped hooks or hook calls with `ssr: false` during SSR'
      );
    },
  });
  return value as any;
}
