import equal from "@wry/equality";
import * as React from "react";

import type {
  Cache,
  MissingTree,
  Reference,
  StoreObject,
} from "@apollo/client/cache";
import type {
  ApolloClient,
  DocumentNode,
  OperationVariables,
  TypedDocumentNode,
} from "@apollo/client/core";
import type { FragmentType, MaybeMasked } from "@apollo/client/masking";
import type { DeepPartial, NoInfer } from "@apollo/client/utilities";

import { useDeepMemo, wrapHook } from "./internal/index.js";
import { useApolloClient } from "./useApolloClient.js";
import { useSyncExternalStore } from "./useSyncExternalStore.js";

export declare namespace useFragment {
  export interface Options<TData, TVariables> {
    /**
     * A GraphQL document created using the `gql` template string tag from
     * `graphql-tag` with one or more fragments which will be used to determine
     * the shape of data to read. If you provide more than one fragment in this
     * document then you must also specify `fragmentName` to select a single.
     */
    fragment: DocumentNode | TypedDocumentNode<TData, TVariables>;

    /**
     * The name of the fragment in your GraphQL document to be used. If you do
     * not provide a `fragmentName` and there is only one fragment in your
     * `fragment` document then that fragment will be used.
     */
    fragmentName?: string;

    /**
     * Any variables that the GraphQL query may depend on.
     */
    variables?: TVariables;

    /**
     * Whether to return incomplete data rather than null.
     * Defaults to false.
     */
    returnPartialData?: boolean;
    /**
     * Whether to read from optimistic or non-optimistic cache data. If
     * this named option is provided, the optimistic parameter of the
     * readQuery method can be omitted. Defaults to false.
     */
    optimistic?: boolean;

    from:
      | StoreObject
      | Reference
      | FragmentType<NoInfer<TData>>
      | string
      | null;

    /**
     * The instance of `ApolloClient` to use to look up the fragment.
     *
     * By default, the instance that's passed down via context is used, but you
     * can provide a different instance here.
     *
     * @docGroup 1. Operation options
     */
    client?: ApolloClient;
  }

  // TODO: Update this to return `null` when there is no data returned from the
  // fragment.
  export type Result<TData> =
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
}

export function useFragment<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(options: useFragment.Options<TData, TVariables>): useFragment.Result<TData> {
  return wrapHook(
    "useFragment",
    // eslint-disable-next-line react-compiler/react-compiler
    useFragment_,
    useApolloClient(options.client)
  )(options);
}

function useFragment_<TData, TVariables extends OperationVariables>(
  options: useFragment.Options<TData, TVariables>
): useFragment.Result<TData> {
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
    const diff = cache.diff<TData, TVariables>({
      ...stableOptions,
      returnPartialData: true,
      id: from,
      query: cache["getFragmentDoc"](fragment, fragmentName),
      optimistic,
    });

    return {
      result: diffToResult(
        {
          ...diff,
          result: client["queryManager"].maskFragment({
            fragment,
            fragmentName,
            // TODO: Revert to `diff.result` once `useFragment` supports `null` as
            // valid return value
            data: diff.result === null ? {} : diff.result,
          }),
        } as Cache.DiffResult<TData> // TODO: Remove assertion
      ),
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
): useFragment.Result<TData> {
  const result = {
    data: diff.result,
    complete: !!diff.complete,
  } as useFragment.Result<TData>; // TODO: Remove assertion once useFragment returns null

  if (diff.missing) {
    result.missing = diff.missing.missing;
  }

  return result;
}
