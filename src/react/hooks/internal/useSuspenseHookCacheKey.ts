import type { DocumentNode } from "graphql";
import * as React from "react";

import type { OperationVariables } from "@apollo/client";
import type { CacheKey } from "@apollo/client/react/internal";
import { canonicalStringify } from "@apollo/client/utilities";

import type { SkipToken } from "../constants.js";
import { skipToken } from "../constants.js";

export declare namespace useSuspenseHookCacheKey {
  export interface Options {
    variables?: OperationVariables;
    queryKey?: string | number | any[];
  }
}

export function useSuspenseHookCacheKey(
  query: DocumentNode,
  options:
    | (SkipToken & Partial<useSuspenseHookCacheKey.Options>)
    | useSuspenseHookCacheKey.Options
) {
  const { queryKey = [], variables } = options;
  const canonicalVariables = canonicalStringify(variables);

  // This state value let's us maintain the variables used for the cache key
  // when `skipToken` is used to skip a query after its been executed.
  // Since options aren't provided when using `skipToken`, `variables` would
  // otherwise disappear which means we'd return a new cache key without a
  // variables value which creates a new `ObservableQuery` instance. This was
  // particularly problematic when `refetchQueries` was used because it meant
  // refetching against an `ObservableQuery` instance that had no variables.
  let [cacheKeyVariables, setCacheKeyVariables] =
    React.useState(canonicalVariables);

  if (options !== skipToken && cacheKeyVariables !== canonicalVariables) {
    setCacheKeyVariables((cacheKeyVariables = canonicalVariables));
  }

  return [
    query,
    cacheKeyVariables,
    ...([] as any[]).concat(queryKey),
  ] satisfies CacheKey;
}
