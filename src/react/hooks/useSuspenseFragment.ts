import type {
  ApolloClient,
  DocumentNode,
  OperationVariables,
  Reference,
  StoreObject,
  TypedDocumentNode,
} from "../../core/index.js";
import { canonicalStringify } from "../../cache/index.js";
import { useApolloClient } from "./useApolloClient.js";
import { getSuspenseCache } from "../internal/index.js";
import React, { useMemo } from "rehackt";
import type { FragmentKey } from "../internal/cache/types.js";
import { __use } from "./internal/__use.js";
import { wrapHook } from "./internal/index.js";
import type { FragmentType, MaybeMasked } from "../../masking/index.js";
import type { NoInfer } from "../types/types.js";
import type { OnlyRequiredProperties } from "../../utilities/index.js";

type From<TData> =
  | StoreObject
  | Reference
  | FragmentType<NoInfer<TData>>
  | string
  | null;

type VariablesOption<TVariables> =
  [TVariables] extends [never] ? { variables?: never }
  : Record<string, never> extends OnlyRequiredProperties<TVariables> ?
    { variables?: TVariables }
  : { variables: TVariables };

export type UseSuspenseFragmentOptions<TData, TVars> = {
  /**
   * A GraphQL document created using the `gql` template string tag from
   * `graphql-tag` with one or more fragments which will be used to determine
   * the shape of data to read. If you provide more than one fragment in this
   * document then you must also specify `fragmentName` to select a single.
   */
  fragment: DocumentNode | TypedDocumentNode<TData, TVars>;

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
  client?: ApolloClient<any>;
} & VariablesOption<NoInfer<TVars>>;

export type UseSuspenseFragmentResult<TData> = { data: MaybeMasked<TData> };

const NULL_PLACEHOLDER = [] as unknown as [
  FragmentKey,
  Promise<MaybeMasked<any> | null>,
];

export function useSuspenseFragment<
  TData,
  TVariables extends OperationVariables = OperationVariables,
>(
  options: UseSuspenseFragmentOptions<TData, TVariables> & {
    from: NonNullable<From<TData>>;
  }
): UseSuspenseFragmentResult<TData>;

export function useSuspenseFragment<
  TData,
  TVariables extends OperationVariables = OperationVariables,
>(
  options: UseSuspenseFragmentOptions<TData, TVariables> & {
    from: null;
  }
): UseSuspenseFragmentResult<null>;

export function useSuspenseFragment<
  TData,
  TVariables extends OperationVariables = OperationVariables,
>(
  options: UseSuspenseFragmentOptions<TData, TVariables> & {
    from: From<TData>;
  }
): UseSuspenseFragmentResult<TData | null>;

export function useSuspenseFragment<
  TData,
  TVariables extends OperationVariables = OperationVariables,
>(
  options: UseSuspenseFragmentOptions<TData, TVariables>
): UseSuspenseFragmentResult<TData>;

export function useSuspenseFragment<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  options: UseSuspenseFragmentOptions<TData, TVariables>
): UseSuspenseFragmentResult<TData | null> {
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
  options: UseSuspenseFragmentOptions<TData, TVariables>
): UseSuspenseFragmentResult<TData | null> {
  const client = useApolloClient(options.client);
  const { from } = options;
  const { cache } = client;

  const id = useMemo(
    () =>
      typeof from === "string" ? from
      : from === null ? null
      : cache.identify(from),
    [cache, from]
  ) as string | null;

  const fragmentRef =
    id === null ? null : (
      getSuspenseCache(client).getFragmentRef<TData, TVariables>(
        [id, options.fragment, canonicalStringify(options.variables)],
        client,
        { ...options, from: id }
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
