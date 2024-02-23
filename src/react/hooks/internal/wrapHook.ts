import type { ApolloClient } from "../../../core/index.js";
import { useApolloClient } from "../useApolloClient.js";
import type {
  useQuery,
  useSuspenseQuery,
  useBackgroundQuery,
  useReadQuery,
  useFragment,
} from "../index.js";

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

interface ApolloClientWithWrappers<T> extends ApolloClient<T> {
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
export function makeHookWrappable<Name extends keyof WrappableHooks>(
  hookName: Name,
  useHook: WrappableHooks[Name],
  clientFromOptions: (
    ...args: Parameters<WrappableHooks[Name]>
  ) => ApolloClientWithWrappers<any> | undefined
): WrappableHooks[Name] {
  return function (this: any) {
    const args = arguments as unknown as Parameters<WrappableHooks[Name]>;
    let client: ApolloClientWithWrappers<any> | undefined;
    try {
      client = useApolloClient(clientFromOptions.apply(this, args));
    } catch {
      /*
      Not wrapped in a `Provider`.
      This is valid for `useReadableQuery`.
      Other hooks will error on their own.
     */
    }
    const wrappers = client && client[wrapperSymbol];
    const wrapper = wrappers && wrappers[hookName];
    const wrappedHook: WrappableHooks[Name] =
      wrapper ? wrapper(useHook) : useHook;
    return (wrappedHook as any).apply(this, args);
  } as any;
}
