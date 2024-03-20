import * as React from "rehackt";
import type { DeepPartial } from "../../utilities/index.js";
import { mergeDeepArray } from "../../utilities/index.js";
import type {
  Cache,
  Reference,
  StoreObject,
  MissingTree,
} from "../../cache/index.js";

import { useApolloClient } from "./useApolloClient.js";
import { useSyncExternalStore } from "./useSyncExternalStore.js";
import type { ApolloClient, OperationVariables } from "../../core/index.js";
import type { NoInfer } from "../types/types.js";
import { useDeepMemo, useLazyRef, wrapHook } from "./internal/index.js";
import equal from "@wry/equality";

export interface UseFragmentOptions<TData, TVars>
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

export type UseFragmentResult<TData> =
  | {
      data: TData;
      complete: true;
      missing?: never;
    }
  | {
      data: DeepPartial<TData>;
      complete: false;
      missing?: MissingTree;
    };

export function useFragment<TData = any, TVars = OperationVariables>(
  options: UseFragmentOptions<TData, TVars>
): UseFragmentResult<TData> {
  return wrapHook(
    "useFragment",
    _useFragment,
    useApolloClient(options.client)
  )(options);
}

function _useFragment<TData = any, TVars = OperationVariables>(
  options: UseFragmentOptions<TData, TVars>
): UseFragmentResult<TData> {
  const { cache } = useApolloClient(options.client);

  const diffOptions = useDeepMemo<Cache.DiffOptions<TData, TVars>>(() => {
    const {
      fragment,
      fragmentName,
      from,
      optimistic = true,
      ...rest
    } = options;

    return {
      ...rest,
      returnPartialData: true,
      id: typeof from === "string" ? from : cache.identify(from),
      query: cache["getFragmentDoc"](fragment, fragmentName),
      optimistic,
    };
  }, [options]);

  const resultRef = useLazyRef<UseFragmentResult<TData>>(() =>
    diffToResult(cache.diff<TData>(diffOptions))
  );

  const stableOptions = useDeepMemo(() => options, [options]);

  // Since .next is async, we need to make sure that we
  // get the correct diff on the next render given new diffOptions
  React.useMemo(() => {
    resultRef.current = diffToResult(cache.diff<TData>(diffOptions));
  }, [diffOptions, cache]);

  // Used for both getSnapshot and getServerSnapshot
  const getSnapshot = React.useCallback(() => resultRef.current, []);

  return useSyncExternalStore(
    React.useCallback(
      (forceUpdate) => {
        let lastTimeout = 0;
        const subscription = cache.watchFragment(stableOptions).subscribe({
          next: (result) => {
            if (equal(result, resultRef.current)) return;
            resultRef.current = result;
            // If we get another update before we've re-rendered, bail out of
            // the update and try again. This ensures that the relative timing
            // between useQuery and useFragment stays roughly the same as
            // fixed in https://github.com/apollographql/apollo-client/pull/11083
            clearTimeout(lastTimeout);
            lastTimeout = setTimeout(forceUpdate) as any;
          },
        });
        return () => {
          subscription.unsubscribe();
          clearTimeout(lastTimeout);
        };
      },
      [cache, stableOptions]
    ),
    getSnapshot,
    getSnapshot
  );
}

function diffToResult<TData>(
  diff: Cache.DiffResult<TData>
): UseFragmentResult<TData> {
  const result = {
    data: diff.result!,
    complete: !!diff.complete,
  } as UseFragmentResult<TData>;

  if (diff.missing) {
    result.missing = mergeDeepArray(diff.missing.map((error) => error.missing));
  }

  return result;
}
