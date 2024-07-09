import type {
  ApolloClient,
  DefaultContext,
  DocumentNode,
  ErrorPolicy,
  OperationVariables,
  RefetchWritePolicy,
  TypedDocumentNode,
  WatchQueryFetchPolicy,
  WatchQueryOptions,
} from "../../core/index.js";
import type {
  DeepPartial,
  OnlyRequiredProperties,
} from "../../utilities/index.js";
import { InternalQueryReference, wrapQueryRef } from "../internal/index.js";
import type { PreloadedQueryRef } from "../internal/index.js";
import type { NoInfer } from "../index.js";
import { wrapHook } from "../hooks/internal/index.js";

type VariablesOption<TVariables extends OperationVariables> =
  [TVariables] extends [never] ?
    {
      /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#variables:member} */
      variables?: Record<string, never>;
    }
  : {} extends OnlyRequiredProperties<TVariables> ?
    {
      /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#variables:member} */
      variables?: TVariables;
    }
  : {
      /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#variables:member} */
      variables: TVariables;
    };

export type PreloadQueryFetchPolicy = Extract<
  WatchQueryFetchPolicy,
  "cache-first" | "network-only" | "no-cache" | "cache-and-network"
>;

export type PreloadQueryOptions<
  TVariables extends OperationVariables = OperationVariables,
> = {
  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#canonizeResults:member} */
  canonizeResults?: boolean;
  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#context:member} */
  context?: DefaultContext;
  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#errorPolicy:member} */
  errorPolicy?: ErrorPolicy;
  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#fetchPolicy:member} */
  fetchPolicy?: PreloadQueryFetchPolicy;
  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#returnPartialData:member} */
  returnPartialData?: boolean;
  /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#refetchWritePolicy:member} */
  refetchWritePolicy?: RefetchWritePolicy;
} & VariablesOption<TVariables>;

type PreloadQueryOptionsArg<
  TVariables extends OperationVariables,
  TOptions = unknown,
> = [TVariables] extends [never] ?
  [options?: PreloadQueryOptions<never> & TOptions]
: {} extends OnlyRequiredProperties<TVariables> ?
  [
    options?: PreloadQueryOptions<NoInfer<TVariables>> &
      Omit<TOptions, "variables">,
  ]
: [
    options: PreloadQueryOptions<NoInfer<TVariables>> &
      Omit<TOptions, "variables">,
  ];

/**
 * A function that will begin loading a query when called. It's result can be
 * read by `useReadQuery` which will suspend until the query is loaded.
 * This is useful when you want to start loading a query as early as possible
 * outside of a React component.
 *
 * @example
 * ```js
 * const preloadQuery = createQueryPreloader(client);
 * const queryRef = preloadQuery(query, { variables, ...otherOptions });
 *
 * function App() {
 *   return (
 *     <Suspense fallback={<div>Loading</div>}>
 *       <MyQuery />
 *     </Suspense>
 *   );
 * }
 *
 * function MyQuery() {
 *   const { data } = useReadQuery(queryRef);
 *
 *   // do something with `data`
 * }
 * ```
 */
export interface PreloadQueryFunction {
  /** {@inheritDoc @apollo/client!PreloadQueryFunction:interface} */
  <
    TData,
    TVariables extends OperationVariables,
    TOptions extends Omit<PreloadQueryOptions, "variables">,
  >(
    query: DocumentNode | TypedDocumentNode<TData, TVariables>,
    ...[options]: PreloadQueryOptionsArg<NoInfer<TVariables>, TOptions>
  ): PreloadedQueryRef<
    TOptions["errorPolicy"] extends "ignore" | "all" ?
      TOptions["returnPartialData"] extends true ?
        DeepPartial<TData> | undefined
      : TData | undefined
    : TOptions["returnPartialData"] extends true ? DeepPartial<TData>
    : TData,
    TVariables
  >;

  /** {@inheritDoc @apollo/client!PreloadQueryFunction:interface} */
  <TData = unknown, TVariables extends OperationVariables = OperationVariables>(
    query: DocumentNode | TypedDocumentNode<TData, TVariables>,
    options: PreloadQueryOptions<NoInfer<TVariables>> & {
      returnPartialData: true;
      errorPolicy: "ignore" | "all";
    }
  ): PreloadedQueryRef<DeepPartial<TData> | undefined, TVariables>;

  /** {@inheritDoc @apollo/client!PreloadQueryFunction:interface} */
  <TData = unknown, TVariables extends OperationVariables = OperationVariables>(
    query: DocumentNode | TypedDocumentNode<TData, TVariables>,
    options: PreloadQueryOptions<NoInfer<TVariables>> & {
      errorPolicy: "ignore" | "all";
    }
  ): PreloadedQueryRef<TData | undefined, TVariables>;

  /** {@inheritDoc @apollo/client!PreloadQueryFunction:interface} */
  <TData = unknown, TVariables extends OperationVariables = OperationVariables>(
    query: DocumentNode | TypedDocumentNode<TData, TVariables>,
    options: PreloadQueryOptions<NoInfer<TVariables>> & {
      returnPartialData: true;
    }
  ): PreloadedQueryRef<DeepPartial<TData>, TVariables>;

  /** {@inheritDoc @apollo/client!PreloadQueryFunction:interface} */
  <TData = unknown, TVariables extends OperationVariables = OperationVariables>(
    query: DocumentNode | TypedDocumentNode<TData, TVariables>,
    ...[options]: PreloadQueryOptionsArg<NoInfer<TVariables>>
  ): PreloadedQueryRef<TData, TVariables>;
}

/**
 * A higher order function that returns a `preloadQuery` function which
 * can be used to begin loading a query with the given `client`. This is useful
 * when you want to start loading a query as early as possible outside of a
 * React component.
 *
 * > Refer to the [Suspense - Initiating queries outside React](https://www.apollographql.com/docs/react/data/suspense#initiating-queries-outside-react) section for a more in-depth overview.
 *
 * @param client - The `ApolloClient` instance that will be used to load queries
 * from the returned `preloadQuery` function.
 * @returns The `preloadQuery` function.
 *
 * @example
 * ```js
 * const preloadQuery = createQueryPreloader(client);
 * ```
 * @since 3.9.0
 */
export function createQueryPreloader(
  client: ApolloClient<any>
): PreloadQueryFunction {
  return wrapHook(
    "createQueryPreloader",
    _createQueryPreloader,
    client
  )(client);
}

const _createQueryPreloader: typeof createQueryPreloader = (client) => {
  return function preloadQuery<
    TData = unknown,
    TVariables extends OperationVariables = OperationVariables,
  >(
    query: DocumentNode | TypedDocumentNode<TData, TVariables>,
    options: PreloadQueryOptions<NoInfer<TVariables>> &
      VariablesOption<TVariables> = Object.create(null)
  ): PreloadedQueryRef<TData, TVariables> {
    const queryRef = new InternalQueryReference(
      client.watchQuery({
        ...options,
        query,
      } as WatchQueryOptions<any, any>),
      {
        autoDisposeTimeoutMs:
          client.defaultOptions.react?.suspense?.autoDisposeTimeoutMs,
      }
    );

    return wrapQueryRef(queryRef) as PreloadedQueryRef<TData, TVariables>;
  };
};
