import * as React from "react";

import type {
  ApolloClient,
  DocumentNode,
  OperationVariables,
  Reference,
  StoreObject,
  TypedDocumentNode,
} from "@apollo/client";
import { canonicalStringify } from "@apollo/client/cache";
import type { FragmentType, MaybeMasked } from "@apollo/client/masking";
import type { VariablesOption } from "@apollo/client/react/internal";
import { getSuspenseCache } from "@apollo/client/react/internal";
import type { NoInfer } from "@apollo/client/utilities";

import type { FragmentKey } from "../internal/cache/types.js";

import { __use } from "./internal/__use.js";
import { wrapHook } from "./internal/index.js";
import { useApolloClient } from "./useApolloClient.js";

type From<TData> =
  | StoreObject
  | Reference
  | FragmentType<NoInfer<TData>>
  | string
  | null;

export declare namespace useSuspenseFragment {
  export type Options<TData, TVariables extends OperationVariables> = {
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
    from: From<TData>;
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
    client?: ApolloClient;
  } & VariablesOption<NoInfer<TVariables>>;

  export type Result<TData> = { data: MaybeMasked<TData> };
}

const NULL_PLACEHOLDER = [] as unknown as [
  FragmentKey,
  Promise<MaybeMasked<any> | null>,
];

export function useSuspenseFragment<
  TData,
  TVariables extends OperationVariables = OperationVariables,
>(
  options: useSuspenseFragment.Options<TData, TVariables> & {
    from: NonNullable<From<TData>>;
  }
): useSuspenseFragment.Result<TData>;

export function useSuspenseFragment<
  TData,
  TVariables extends OperationVariables = OperationVariables,
>(
  options: useSuspenseFragment.Options<TData, TVariables> & {
    from: null;
  }
): useSuspenseFragment.Result<null>;

export function useSuspenseFragment<
  TData,
  TVariables extends OperationVariables = OperationVariables,
>(
  options: useSuspenseFragment.Options<TData, TVariables> & {
    from: From<TData>;
  }
): useSuspenseFragment.Result<TData | null>;

export function useSuspenseFragment<
  TData,
  TVariables extends OperationVariables = OperationVariables,
>(
  options: useSuspenseFragment.Options<TData, TVariables>
): useSuspenseFragment.Result<TData>;

export function useSuspenseFragment<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  options: useSuspenseFragment.Options<TData, TVariables>
): useSuspenseFragment.Result<TData | null> {
  return wrapHook(
    "useSuspenseFragment",
    // eslint-disable-next-line react-compiler/react-compiler
    useSuspenseFragment_,
    useApolloClient(typeof options === "object" ? options.client : undefined)
  )(options);
}

function useSuspenseFragment_<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  options: useSuspenseFragment.Options<TData, TVariables>
): useSuspenseFragment.Result<TData | null> {
  const client = useApolloClient(options.client);
  const { from, variables } = options;
  const { cache } = client;

  const id = React.useMemo(
    () =>
      typeof from === "string" ? from
      : from === null ? null
      : cache.identify(from),
    [cache, from]
  ) as string | null;

  const fragmentRef =
    id === null ? null : (
      getSuspenseCache(client).getFragmentRef(
        [id, options.fragment, canonicalStringify(variables)],
        client,
        { ...options, variables: variables as TVariables, from: id }
      )
    );

  let [current, setPromise] = React.useState<
    [FragmentKey, Promise<MaybeMasked<TData> | null>]
  >(
    fragmentRef === null ? NULL_PLACEHOLDER : (
      [fragmentRef.key, fragmentRef.promise]
    )
  );

  React.useEffect(() => {
    if (fragmentRef === null) {
      return;
    }

    const dispose = fragmentRef.retain();
    const removeListener = fragmentRef.listen((promise) => {
      setPromise([fragmentRef.key, promise]);
    });

    return () => {
      dispose();
      removeListener();
    };
  }, [fragmentRef]);

  if (fragmentRef === null) {
    return { data: null };
  }

  if (current[0] !== fragmentRef.key) {
    // eslint-disable-next-line react-compiler/react-compiler
    current[0] = fragmentRef.key;
    current[1] = fragmentRef.promise;
  }

  const data = __use(current[1]);

  return { data };
}
