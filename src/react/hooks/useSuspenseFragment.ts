import * as React from "react";

import type {
  ApolloClient,
  DataValue,
  DocumentNode,
  OperationVariables,
  TypedDocumentNode,
} from "@apollo/client";
import type { ApolloCache } from "@apollo/client/cache";
import { canonicalStringify } from "@apollo/client/cache";
import type { MaybeMasked } from "@apollo/client/masking";
import type { FragmentKey } from "@apollo/client/react/internal";
import { getSuspenseCache } from "@apollo/client/react/internal";
import type {
  DocumentationTypes as UtilityDocumentationTypes,
  NoInfer,
  VariablesOption,
} from "@apollo/client/utilities/internal";

import { __use } from "./internal/__use.js";
import { useDeepMemo, wrapHook } from "./internal/index.js";
import { useApolloClient } from "./useApolloClient.js";

export declare namespace useSuspenseFragment {
  import _self = useSuspenseFragment;
  export namespace Base {
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

      /**
       * An object or array containing a `__typename` and primary key fields
       * (such as `id`) identifying the entity object from which the fragment will
       * be retrieved, or a `{ __ref: "..." }` reference, or a `string` ID (uncommon).
       */
      from:
        | useSuspenseFragment.FromValue<TData>
        | Array<useSuspenseFragment.FromValue<TData> | null>
        | null;

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
    };
  }
  export type Options<
    TData,
    TVariables extends OperationVariables,
  > = Base.Options<TData, TVariables> & VariablesOption<NoInfer<TVariables>>;

  export namespace DocumentationTypes {
    export namespace useSuspenseFragment {
      export interface Options<
        TData = unknown,
        TVariables extends OperationVariables = OperationVariables,
      > extends Base.Options<TData, TVariables>,
          UtilityDocumentationTypes.VariableOptions<TVariables> {}
    }
  }

  /**
   * Acceptable values provided to the `from` option.
   */
  export type FromValue<TData> = ApolloCache.FromValue<TData>;

  export interface Result<TData> {
    data: DataValue.Complete<MaybeMasked<TData>>;
  }
  export namespace DocumentationTypes {
    export namespace useSuspenseFragment {
      export interface Result<TData = unknown> extends _self.Result<TData> {}
    }
  }

  export namespace DocumentationTypes {
    /** {@inheritDoc @apollo/client/react!useSuspenseFragment:function(1)} */
    export function useSuspenseFragment<
      TData,
      TVariables extends OperationVariables = OperationVariables,
    >(
      options: useSuspenseFragment.Options<TData, TVariables>
    ): useSuspenseFragment.Result<TData>;
  }
}

/** #TODO documentation */
export function useSuspenseFragment<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  options: useSuspenseFragment.Options<TData, TVariables> & {
    from: Array<useSuspenseFragment.FromValue<TData>>;
  }
): useSuspenseFragment.Result<Array<TData>>;

/** {@inheritDoc @apollo/client/react!useSuspenseFragment:function(1)} */
export function useSuspenseFragment<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  options: useSuspenseFragment.Options<TData, TVariables> & {
    from: Array<null>;
  }
): useSuspenseFragment.Result<Array<null>>;

/** {@inheritDoc @apollo/client/react!useSuspenseFragment:function(1)} */
export function useSuspenseFragment<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  options: useSuspenseFragment.Options<TData, TVariables> & {
    from: Array<useSuspenseFragment.FromValue<TData> | null>;
  }
): useSuspenseFragment.Result<Array<TData | null>>;

/** {@inheritDoc @apollo/client/react!useSuspenseFragment:function(1)} */
export function useSuspenseFragment<
  TData,
  TVariables extends OperationVariables = OperationVariables,
>(
  options: useSuspenseFragment.Options<TData, TVariables> & {
    from: useSuspenseFragment.FromValue<TData>;
  }
): useSuspenseFragment.Result<TData>;

/** {@inheritDoc @apollo/client/react!useSuspenseFragment:function(1)} */
export function useSuspenseFragment<
  TData,
  TVariables extends OperationVariables = OperationVariables,
>(
  options: useSuspenseFragment.Options<TData, TVariables> & {
    from: null;
  }
): useSuspenseFragment.Result<null>;

/** {@inheritDoc @apollo/client/react!useSuspenseFragment:function(1)} */
export function useSuspenseFragment<
  TData,
  TVariables extends OperationVariables = OperationVariables,
>(
  options: useSuspenseFragment.Options<TData, TVariables> & {
    from: useSuspenseFragment.FromValue<TData> | null;
  }
): useSuspenseFragment.Result<TData | null>;

/** {@inheritDoc @apollo/client/react!useSuspenseFragment:function(1)} */
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
  "use no memo";
  return wrapHook(
    "useSuspenseFragment",
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

  const ids = useDeepMemo(() => {
    return Array.isArray(from) ?
        from.map((id) => toStringId(cache, id))
      : toStringId(cache, from);
  }, [cache, from]);
  const idString = React.useMemo(
    () => (Array.isArray(ids) ? ids.join(",") : ids),
    [ids]
  );

  const fragmentRef = getSuspenseCache(client).getFragmentRef(
    [options.fragment, canonicalStringify(variables), idString],
    client,
    { ...options, variables: variables as TVariables, from: ids }
  );

  let [current, setPromise] = React.useState<
    [FragmentKey, Promise<MaybeMasked<TData> | null>]
  >([fragmentRef.key, fragmentRef.promise]);

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

  if (current[0] !== fragmentRef.key) {
    // eslint-disable-next-line react-hooks/immutability
    current[0] = fragmentRef.key;
    // eslint-disable-next-line react-hooks/immutability
    current[1] = fragmentRef.promise;
  }

  const data = __use(current[1]);

  return { data };
}

function toStringId(
  cache: ApolloCache,
  from: useSuspenseFragment.FromValue<any> | null
) {
  return (
    typeof from === "string" ? from
    : from === null ? null
    : cache.identify(from)) as string | null;
}
