import * as React from "rehackt";
import type { DeepPartial } from "../../utilities/index.js";
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
import { useDeepMemo, wrapHook } from "./internal/index.js";
import equal from "@wry/equality";
import type { FragmentType, MaybeMasked } from "../../masking/index.js";

export interface UseFragmentOptions<TData, TVars>
  extends Omit<
      Cache.DiffOptions<NoInfer<TData>, NoInfer<TVars>>,
      "id" | "query" | "optimistic" | "previousResult" | "returnPartialData"
    >,
    Omit<
      Cache.ReadFragmentOptions<TData, TVars>,
      "id" | "variables" | "returnPartialData"
    > {
  from: StoreObject | Reference | FragmentType<NoInfer<TData>> | string | null;
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

// TODO: Update this to return `null` when there is no data returned from the
// fragment.
export type UseFragmentResult<TData> =
  | {
      data: MaybeMasked<TData>;
      complete: true;
      missing?: never;
    }
  | {
      data: DeepPartial<MaybeMasked<TData>>;
      complete: false;
      missing?: MissingTree;
    };

export function useFragment<TData = any, TVars = OperationVariables>(
  options: UseFragmentOptions<TData, TVars>
): UseFragmentResult<TData> {
  return wrapHook(
    "useFragment",
    // eslint-disable-next-line react-compiler/react-compiler
    useFragment_,
    useApolloClient(options.client)
  )(options);
}

function useFragment_<TData = any, TVars = OperationVariables>(
  options: UseFragmentOptions<TData, TVars>
): UseFragmentResult<TData> {
  const client = useApolloClient(options.client);
  const { cache } = client;
  const { from, ...rest } = options;

  // We calculate the cache id seperately from `stableOptions` because we don't
  // want changes to non key fields in the `from` property to affect
  // `stableOptions` and retrigger our subscription. If the cache identifier
  // stays the same between renders, we want to reuse the existing subscription.
  const id = React.useMemo(
    () =>
      typeof from === "string" ? from
      : from === null ? null
      : cache.identify(from),
    [cache, from]
  );

  const stableOptions = useDeepMemo(() => ({ ...rest, from: id! }), [rest, id]);

  // Since .next is async, we need to make sure that we
  // get the correct diff on the next render given new diffOptions
  const diff = React.useMemo(() => {
    const { fragment, fragmentName, from, optimistic = true } = stableOptions;

    if (from === null) {
      return {
        result: diffToResult({
          result: {},
          complete: false,
        } as Cache.DiffResult<TData>),
      };
    }

    const { cache } = client;
    const diff = cache.diff<TData>({
      ...stableOptions,
      returnPartialData: true,
      id: from,
      query: cache["getFragmentDoc"](fragment, fragmentName),
      optimistic,
    });

    return {
      result: diffToResult({
        ...diff,
        result: client["queryManager"].maskFragment({
          fragment,
          fragmentName,
          // TODO: Revert to `diff.result` once `useFragment` supports `null` as
          // valid return value
          data: diff.result === null ? {} : diff.result,
        }),
      } as Cache.DiffResult<TData>),
    };
  }, [client, stableOptions]);

  // Used for both getSnapshot and getServerSnapshot
  const getSnapshot = React.useCallback(() => diff.result, [diff]);

  return useSyncExternalStore(
    React.useCallback(
      (forceUpdate) => {
        let lastTimeout = 0;

        const subscription =
          stableOptions.from === null ?
            null
          : client.watchFragment(stableOptions).subscribe({
              next: (result) => {
                // Since `next` is called async by zen-observable, we want to avoid
                // unnecessarily rerendering this hook for the initial result
                // emitted from watchFragment which should be equal to
                // `diff.result`.
                if (equal(result, diff.result)) return;
                diff.result = result;
                // If we get another update before we've re-rendered, bail out of
                // the update and try again. This ensures that the relative timing
                // between useQuery and useFragment stays roughly the same as
                // fixed in https://github.com/apollographql/apollo-client/pull/11083
                clearTimeout(lastTimeout);
                lastTimeout = setTimeout(forceUpdate) as any;
              },
            });
        return () => {
          subscription?.unsubscribe();
          clearTimeout(lastTimeout);
        };
      },
      [client, stableOptions, diff]
    ),
    getSnapshot,
    getSnapshot
  );
}

function diffToResult<TData>(
  diff: Cache.DiffResult<TData>
): UseFragmentResult<TData> {
  const result = {
    data: diff.result,
    complete: !!diff.complete,
  } as UseFragmentResult<TData>;

  if (diff.missing) {
    result.missing = diff.missing.missing;
  }

  return result;
}
