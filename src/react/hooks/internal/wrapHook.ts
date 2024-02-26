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
 * Can be used to correctly type the [Symbol.for("apollo.hook.wrappers")] of
 * a class that extends `ApolloClient`, to override/wrap hook functionality.
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
 * const wrappedUseQuery = makeHookWrappable('useQuery', useQuery, (_, options) => options.client);
 *
 * // this is what a library like `@apollo/client-react-streaming` would do
 * class ApolloClientWithStreaming extends ApolloClient {
 *   [Symbol.for("apollo.hook.wrappers")] = {
 *     useQuery: (original) => (query, options) => {
 *       console.log("useQuery was called with options", options);
 *       return original(query, options);
 *     }
 *   }
 * }
 *
 * // this will now log the options and then call the original `useQuery`
 * const client = new ApolloClientWithStreaming({ ... });
 * wrappedUseQuery(query, { client });
 * ```
 */
/*#__NO_SIDE_EFFECTS__*/
export function makeHookWrappable<Name extends keyof WrappableHooks>(
  hookName: Name,
  getClientFromOptions: (
    ...args: Parameters<WrappableHooks[Name]>
  ) => ObservableQuery<any> | ApolloClient<any>,
  useHook: WrappableHooks[Name]
): WrappableHooks[Name] {
  return function (this: any) {
    const args = arguments as unknown as Parameters<WrappableHooks[Name]>;
    const queryManager = (
      getClientFromOptions.apply(this, args) as unknown as {
        // both `ApolloClient` and `ObservableQuery` have a `queryManager` property
        // but they're both `private`, so we have to cast around for a bit here.
        queryManager: QueryManagerWithWrappers<any>;
      }
    )["queryManager"];
    const wrappers = queryManager && queryManager[wrapperSymbol];
    const wrapper = wrappers && wrappers[hookName];
    const wrappedHook: WrappableHooks[Name] =
      wrapper ? wrapper(useHook) : useHook;
    return (wrappedHook as any).apply(this, args);
  } as any;
}
