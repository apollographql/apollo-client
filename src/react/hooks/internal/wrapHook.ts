import type {
  useQuery,
  useSuspenseQuery,
  useBackgroundQuery,
  useReadQuery,
  useFragment,
} from "../index.js";
import type { QueryManager } from "../../../core/QueryManager.js";
import type { ApolloClient } from "../../../core/ApolloClient.js";
import type { ObservableQuery } from "../../../core/ObservableQuery.js";

const wrapperSymbol = Symbol.for("apollo.hook.wrappers");

interface WrappableHooks {
  useQuery: typeof useQuery;
  useSuspenseQuery: typeof useSuspenseQuery;
  useBackgroundQuery: typeof useBackgroundQuery;
  useReadQuery: typeof useReadQuery;
  useFragment: typeof useFragment;
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

interface QueryManagerWithWrappers<T> extends QueryManager<T> {
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
  clientOrObsQuery: ObservableQuery<any> | ApolloClient<any>
): Hook {
  const queryManager = (
    clientOrObsQuery as unknown as {
      // both `ApolloClient` and `ObservableQuery` have a `queryManager` property
      // but they're both `private`, so we have to cast around for a bit here.
      queryManager: QueryManagerWithWrappers<any>;
    }
  )["queryManager"];
  const wrappers = queryManager && queryManager[wrapperSymbol];
  const wrapper: undefined | ((wrap: Hook) => Hook) =
    wrappers && (wrappers[hookName] as any);
  return wrapper ? wrapper(useHook) : useHook;
}
