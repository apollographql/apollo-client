import type { MatcherFunction } from "expect";
import type { DocumentNode } from "graphql";

import type { OperationVariables } from "@apollo/client";
import { ApolloClient } from "@apollo/client";
import { canonicalStringify } from "@apollo/client/cache";
import type { CacheKey } from "@apollo/client/react/internal";
import { getSuspenseCache } from "@apollo/client/react/internal";

export const toHaveSuspenseCacheEntryUsing: MatcherFunction<
  [
    query: DocumentNode,
    options: {
      variables?: OperationVariables;
      queryKey?: string | number | any[];
    },
  ]
> = function (client, query, { variables, queryKey = [] } = {}) {
  if (!(client instanceof ApolloClient)) {
    throw new Error("Actual must be an instance of `ApolloClient`");
  }

  const suspenseCache = getSuspenseCache(client);

  const cacheKey: CacheKey = [
    query,
    canonicalStringify(variables),
    ...([] as any[]).concat(queryKey),
  ];
  const queryRef = suspenseCache["queryRefs"].lookupArray(cacheKey)?.current;

  return {
    pass: !!queryRef,
    message: () => {
      return `Expected suspense cache ${
        queryRef ? "not " : ""
      }to have cache entry using key`;
    },
  };
};
