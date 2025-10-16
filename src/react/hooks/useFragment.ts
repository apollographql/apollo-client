import * as React from "react";

import type {
  ApolloClient,
  DataValue,
  DocumentNode,
  GetDataState,
  OperationVariables,
  TypedDocumentNode,
} from "@apollo/client";
import type { MissingTree, Reference, StoreObject } from "@apollo/client/cache";
import type { FragmentType, MaybeMasked } from "@apollo/client/masking";
import type { NoInfer } from "@apollo/client/utilities/internal";

import { useDeepMemo, wrapHook } from "./internal/index.js";
import { useApolloClient } from "./useApolloClient.js";
import { useSyncExternalStore } from "./useSyncExternalStore.js";

export declare namespace useFragment {
  import _self = useFragment;
  export interface Options<TData, TVariables extends OperationVariables> {
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
    variables?: NoInfer<TVariables>;

    /**
     * An object containing a `__typename` and primary key fields (such as `id`) identifying the entity object from which the fragment will be retrieved, or a `{ __ref: "..." }` reference, or a `string` ID (uncommon).
     */
    from:
      | StoreObject
      | Reference
      | FragmentType<NoInfer<TData>>
      | string
      | null
      | Array<
          StoreObject | Reference | FragmentType<NoInfer<TData>> | string | null
        >;

    /**
     * Whether to read from optimistic or non-optimistic cache data. If
     * this named option is provided, the optimistic parameter of the
     * readQuery method can be omitted.
     *
     * @defaultValue true
     */
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
  }

  namespace DocumentationTypes {
    namespace useFragment {
      export interface Options<
        TData = unknown,
        TVariables extends OperationVariables = OperationVariables,
      > extends _self.Options<TData, TVariables> {}
    }
  }

  // TODO: Update this to return `null` when there is no data returned from the
  // fragment.
  export type Result<TData> =
    | ({
        /** {@inheritDoc @apollo/client/react!useFragment.DocumentationTypes.useFragment.Result#complete:member} */
        complete: true;
        /** {@inheritDoc @apollo/client/react!useFragment.DocumentationTypes.useFragment.Result#missing:member} */
        missing?: never;
      } & GetDataState<MaybeMasked<TData>, "complete">)
    | {
        /** {@inheritDoc @apollo/client/react!useFragment.DocumentationTypes.useFragment.Result#complete:member} */
        complete: false;
        /** {@inheritDoc @apollo/client/react!useFragment.DocumentationTypes.useFragment.Result#missing:member} */
        missing?: MissingTree;
        /** {@inheritDoc @apollo/client!QueryResultDocumentation#data:member} */
        data: TData extends Array<infer TItem> ?
          Array<DataValue.Partial<TItem | null>>
        : DataValue.Partial<TData>;
        /** {@inheritDoc @apollo/client!QueryResultDocumentation#dataState:member} */
        dataState: "partial";
      };

  export namespace DocumentationTypes {
    namespace useFragment {
      export interface Result<TData> {
        data: MaybeMasked<TData> | DataValue.Partial<MaybeMasked<TData>>;
        complete: boolean;
        /**
         * A tree of all `MissingFieldError` messages reported during fragment reading, where the branches of the tree indicate the paths of the errors within the query result.
         */
        missing?: MissingTree;
      }
    }
  }
  export namespace DocumentationTypes {
    /** {@inheritDoc @apollo/client/react!useFragment:function(1)} */
    export function useFragment<
      TData = unknown,
      TVariables extends OperationVariables = OperationVariables,
    >({
      fragment,
      from,
      fragmentName,
      variables,
      optimistic,
      client,
    }: useFragment.Options<TData, TVariables>): useFragment.Result<TData>;
  }
}

/**
 * `useFragment` represents a lightweight live binding into the Apollo Client Cache and enables Apollo Client to broadcast very specific fragment results to individual components. This hook returns an always-up-to-date view of whatever data the cache currently contains for a given fragment. `useFragment` never triggers network requests of its own.
 *
 * Note that the `useQuery` hook remains the primary hook responsible for querying and populating data in the cache ([see the API reference](./hooks#usequery)). As a result, the component reading the fragment data via `useFragment` is still subscribed to all changes in the query data, but receives updates only when that fragment's specific data change.
 *
 * To view a `useFragment` example, see the [Fragments](https://www.apollographql.com/docs/react/data/fragments#usefragment) page.
 */
export function useFragment<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  options: useFragment.Options<TData, TVariables> & {
    from: Array<any>;
  }
): useFragment.Result<Array<TData>>;

/** {@inheritDoc @apollo/client/react!useFragment:function(1)} */
export function useFragment<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(options: useFragment.Options<TData, TVariables>): useFragment.Result<TData>;

export function useFragment<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
>(
  options: useFragment.Options<TData, TVariables>
): useFragment.Result<TData> | useFragment.Result<Array<TData>> {
  "use no memo";
  return wrapHook(
    "useFragment",
    // eslint-disable-next-line react-compiler/react-compiler
    useFragment_,
    useApolloClient(options.client)
  )(options);
}

function useFragment_<TData, TVariables extends OperationVariables>(
  options: useFragment.Options<TData, TVariables>
): useFragment.Result<TData> | useFragment.Result<Array<TData>> {
  const client = useApolloClient(options.client);
  const { from, ...rest } = options;
  const { cache } = client;

  // We calculate the cache id seperately because we don't want changes to non
  // key fields in the `from` property to recreate the observable. If the cache
  // identifier stays the same between renders, we want to reuse the existing
  // subscription.
  const ids = useDeepMemo(() => {
    const fromArray = Array.isArray(from) ? from : [from];

    const ids = fromArray.map((value) =>
      typeof value === "string" ? value
      : value === null ? null
      : cache.identify(value)
    );

    return Array.isArray(from) ? ids : ids[0];
  }, [from]);

  const [previousClient, setPreviousClient] = React.useState(client);
  const [observable, setObservable] = React.useState(() =>
    client.watchFragment({ ...rest, from: ids as any })
  );

  React.useMemo(() => {
    observable.reobserve({ from: ids as any });
  }, [observable, ids]);

  if (client !== previousClient) {
    setPreviousClient(client);
    setObservable(client.watchFragment({ ...rest, from: ids as any }));
  }

  const currentResultRef =
    React.useRef<ReturnType<typeof observable.getCurrentResult>>(undefined);

  const getSnapshot = React.useCallback(() => {
    const result = observable.getCurrentResult();
    currentResultRef.current = result;
    return result;
  }, [observable]);

  return useSyncExternalStore(
    React.useCallback(
      (update) => {
        let lastTimeout = 0;
        const subscription = observable.subscribe({
          next: (result) => {
            // If we get another update before we've re-rendered, bail out of
            // the update and try again. This ensures that the relative timing
            // between useQuery and useFragment stays roughly the same as
            // fixed in https://github.com/apollographql/apollo-client/pull/11083
            clearTimeout(lastTimeout);
            lastTimeout = setTimeout(() => {
              // After the initial mount, React will always rerender the
              // component when calling update() even if getSnapshot() doesn't
              // change. We want to avoid rerendering the component if
              // getSnapshot has already rendered this value.
              //
              // This can happen when rerendering with new IDs when reobserve is
              // called since the value is synchronously updated.
              if (currentResultRef.current !== result) {
                update();
              }
            }) as any;
          },
        });

        return () => {
          subscription.unsubscribe();
          clearTimeout(lastTimeout);
        };
      },
      [observable]
    ),
    getSnapshot,
    getSnapshot
  );
}
