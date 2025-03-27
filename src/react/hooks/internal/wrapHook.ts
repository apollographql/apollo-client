import * as React from "react";

import type { ApolloClient } from "@apollo/client/core";
import type { ObservableQuery } from "@apollo/client/core";
import type { createQueryPreloader } from "@apollo/client/react";
import type {
  useBackgroundQuery,
  useFragment,
  useQuery,
  useQueryRefHandlers,
  useReadQuery,
  useSuspenseFragment,
  useSuspenseQuery,
} from "@apollo/client/react/hooks";

import type { QueryManager } from "../../../core/QueryManager.js";
// direct import to avoid circular dependency
import { getApolloContext } from "../../context/ApolloContext.js";

export const wrapperSymbol = Symbol.for("apollo.hook.wrappers");

type FunctionSignature<T> =
  T extends (...args: infer A) => infer R ? (...args: A) => R : never;

interface WrappableHooks {
  createQueryPreloader: typeof createQueryPreloader;
  useQuery: FunctionSignature<typeof useQuery>;
  useSuspenseQuery: typeof useSuspenseQuery;
  useSuspenseFragment: typeof useSuspenseFragment;
  useBackgroundQuery: typeof useBackgroundQuery;
  useReadQuery: typeof useReadQuery;
  useFragment: typeof useFragment;
  useQueryRefHandlers: typeof useQueryRefHandlers;
}

/**
 * @internal
 * Can be used to correctly type the [Symbol.for("apollo.hook.wrappers")] property of
 * `QueryManager`, to override/wrap hook functionality.
 */
export type HookWrappers = {
  [K in keyof WrappableHooks]?: (
    originalHook: WrappableHooks[K]
  ) => WrappableHooks[K];
};

interface QueryManagerWithWrappers extends QueryManager {
  [wrapperSymbol]?: HookWrappers;
}

/**
 * @internal
 *
 * Makes an Apollo Client hook "wrappable".
 * That means that the Apollo Client instance can expose a "wrapper" that will be
 * used to wrap the original hook implementation with additional logic.
 * @example
 * ```tsx
 * // this is already done in `@apollo/client` for all wrappable hooks (see `WrappableHooks`)
 * // following this pattern
 * function useQuery() {
 *   return wrapHook('useQuery', _useQuery, options.client)(query, options);
 * }
 * function _useQuery(query, options) {
 *   // original implementation
 * }
 *
 * // this is what a library like `@apollo/client-react-streaming` would do
 * class ApolloClientWithStreaming extends ApolloClient {
 *   constructor(options) {
 *     super(options);
 *     this.queryManager[Symbol.for("apollo.hook.wrappers")] = {
 *       useQuery: (original) => (query, options) => {
 *         console.log("useQuery was called with options", options);
 *         return original(query, options);
 *       }
 *     }
 *   }
 * }
 *
 * // this will now log the options and then call the original `useQuery`
 * const client = new ApolloClientWithStreaming({ ... });
 * useQuery(query, { client });
 * ```
 */
export function wrapHook<Hook extends (...args: any[]) => any>(
  hookName: keyof WrappableHooks,
  useHook: Hook,
  clientOrObsQuery: ObservableQuery<any> | ApolloClient
): Hook {
  // Priority-wise, the later entries in this array wrap
  // previous entries and could prevent them (and in the end,
  // even the original hook) from running
  const wrapperSources = [
    (
      clientOrObsQuery as unknown as {
        // both `ApolloClient` and `ObservableQuery` have a `queryManager` property
        // but they're both `private`, so we have to cast around for a bit here.
        queryManager: QueryManagerWithWrappers;
      }
    )["queryManager"],
    // if we are a hook (not `preloadQuery`), we are guaranteed to be inside of
    // a React render and can use context
    hookName.startsWith("use") ?
      // eslint-disable-next-line react-hooks/rules-of-hooks
      React.useContext(getApolloContext())
    : undefined,
  ];

  let wrapped = useHook;
  for (const source of wrapperSources) {
    const wrapper = source?.[wrapperSymbol]?.[hookName];
    if (wrapper) {
      wrapped = wrapper(wrapped) as Hook;
    }
  }

  return wrapped;
}
