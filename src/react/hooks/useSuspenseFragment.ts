import type { ApolloClient, Reference, StoreObject } from "../../core/index.js";
import { canonicalStringify } from "../../cache/index.js";
import type { Cache } from "../../cache/index.js";
import { useApolloClient } from "./useApolloClient.js";
import { getSuspenseCache } from "../internal/index.js";
import type { CacheKey } from "../internal/index.js";
import React from "rehackt";
import type { FragmentKey } from "../internal/cache/types.js";
import { __use } from "./internal/__use.js";

export interface UseSuspenseFragmentOptions<TData, TVars>
  extends Omit<
      Cache.DiffOptions<NoInfer<TData>, NoInfer<TVars>>,
      "id" | "query" | "optimistic" | "previousResult" | "returnPartialData"
    >,
    Omit<
      Cache.ReadFragmentOptions<TData, TVars>,
      "id" | "variables" | "returnPartialData"
    > {
  from: StoreObject | Reference | string;
  // Override this field to make it optional (default: true).
  optimistic?: boolean;
  /**
   * The instance of `ApolloClient` to use to look up the fragment.
   *
   * By default, the instance that's passed down via context is used, but you
   * can provide a different instance here.
   *
   * @docGroup 1. Operation options
   */
  client?: ApolloClient<any>;
}

export type UseSuspenseFragmentResult<TData> = { data: TData };

export function useSuspenseFragment<TData, TVariables>(
  options: UseSuspenseFragmentOptions<TData, TVariables>
): UseSuspenseFragmentResult<TData> {
  const client = useApolloClient(options.client);

  const cacheKey: CacheKey = [
    options.fragment,
    canonicalStringify(options.variables),
  ];

  const fragmentRef = getSuspenseCache(client).getFragmentRef<TData>(
    cacheKey,
    () => client.watchFragment(options)
  );

  let [current, setPromise] = React.useState<[FragmentKey, Promise<TData>]>([
    fragmentRef.key,
    fragmentRef.promise,
  ]);

  if (current[0] !== fragmentRef.key) {
    // eslint-disable-next-line react-compiler/react-compiler
    current[0] = fragmentRef.key;
    current[1] = fragmentRef.promise;
  }

  React.useEffect(() => {
    const dispose = fragmentRef.retain();
    const removeListener = fragmentRef.listen((promise) => {
      setPromise([fragmentRef.key, promise]);
    });

    return () => {
      dispose();
      removeListener();
    };
  }, [fragmentRef]);

  let promise = current[1];

  const data = __use(promise);

  return { data };
}
