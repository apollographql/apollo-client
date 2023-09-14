import type { MatcherFunction } from "expect";
import type { DocumentNode } from "graphql";
import type { OperationVariables } from "../../core/index.js";
import { ApolloClient } from "../../core/index.js";
import { canonicalStringify } from "../../cache/index.js";
import { getSuspenseCache } from "../../react/cache/index.js";
import type { CacheKey } from "../../react/cache/types.js";

export const toHaveSuspenseCacheEntryUsing: MatcherFunction<
  [
    query: DocumentNode,
    options: {
      variables?: OperationVariables;
      queryKey?: string | number | any[];
    },
  ]
> = function (
  client,
  query,
  { variables, queryKey = [] } = Object.create(null)
) {
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
