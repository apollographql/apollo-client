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
import {
  InternalQueryReference,
  wrapQueryRef,
} from "../cache/QueryReference.js";
import type { QueryReference } from "../cache/QueryReference.js";
import type { NoInfer } from "../index.js";

type VariablesOption<TVariables extends OperationVariables> =
  [TVariables] extends [never] ?
    {
      /** {@inheritDoc @apollo/client!WatchQueryOptions#refetchWritePolicy:member} */
      variables?: Record<string, never>;
    }
  : {} extends OnlyRequiredProperties<TVariables> ?
    {
      /** {@inheritDoc @apollo/client!WatchQueryOptions#refetchWritePolicy:member} */
      variables?: TVariables;
    }
  : {
      /** {@inheritDoc @apollo/client!WatchQueryOptions#variables:member} */
      variables: TVariables;
    };

export type PreloadQueryFetchPolicy = Extract<
  WatchQueryFetchPolicy,
  "cache-first" | "network-only" | "no-cache" | "cache-and-network"
>;

export type PreloadQueryOptions<
  TVariables extends OperationVariables = OperationVariables,
> = {
  /** {@inheritDoc @apollo/client!WatchQueryOptions#canonizeResults:member} */
  canonizeResults?: boolean;
  /** {@inheritDoc @apollo/client!WatchQueryOptions#context:member} */
  context?: DefaultContext;
  /** {@inheritDoc @apollo/client!WatchQueryOptions#errorPolicy:member} */
  errorPolicy?: ErrorPolicy;
  /** {@inheritDoc @apollo/client!WatchQueryOptions#fetchPolicy:member} */
  fetchPolicy?: PreloadQueryFetchPolicy;
  /** {@inheritDoc @apollo/client!WatchQueryOptions#returnPartialData:member} */
  returnPartialData?: boolean;
  /** {@inheritDoc @apollo/client!WatchQueryOptions#refetchWritePolicy:member} */
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
 * read by {@link useReadQuery} which will suspend until the query is loaded.
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
  <
    TData,
    TVariables extends OperationVariables,
    TOptions extends Omit<PreloadQueryOptions, "variables">,
  >(
    query: DocumentNode | TypedDocumentNode<TData, TVariables>,
    ...[options]: PreloadQueryOptionsArg<NoInfer<TVariables>, TOptions>
  ): QueryReference<
    TOptions["errorPolicy"] extends "ignore" | "all" ?
      TOptions["returnPartialData"] extends true ?
        DeepPartial<TData> | undefined
      : TData | undefined
    : TOptions["returnPartialData"] extends true ? DeepPartial<TData>
    : TData,
    TVariables
  >;

  <TData = unknown, TVariables extends OperationVariables = OperationVariables>(
    query: DocumentNode | TypedDocumentNode<TData, TVariables>,
    options: PreloadQueryOptions<NoInfer<TVariables>> & {
      returnPartialData: true;
      errorPolicy: "ignore" | "all";
    }
  ): QueryReference<DeepPartial<TData> | undefined, TVariables>;

  <TData = unknown, TVariables extends OperationVariables = OperationVariables>(
    query: DocumentNode | TypedDocumentNode<TData, TVariables>,
    options: PreloadQueryOptions<NoInfer<TVariables>> & {
      errorPolicy: "ignore" | "all";
    }
  ): QueryReference<TData | undefined, TVariables>;

  <TData = unknown, TVariables extends OperationVariables = OperationVariables>(
    query: DocumentNode | TypedDocumentNode<TData, TVariables>,
    options: PreloadQueryOptions<NoInfer<TVariables>> & {
      returnPartialData: true;
    }
  ): QueryReference<DeepPartial<TData>, TVariables>;

  <TData = unknown, TVariables extends OperationVariables = OperationVariables>(
    query: DocumentNode | TypedDocumentNode<TData, TVariables>,
    ...[options]: PreloadQueryOptionsArg<NoInfer<TVariables>>
  ): QueryReference<TData, TVariables>;
}

/**
 * A higher order function that returns a {@link preloadQuery} function which
 * can be used to begin loading a query with the given `client`. This is useful
 * when you want to start loading a query as early as possible outside of a
 * React component.
 *
 * @param client - The ApolloClient instance that will be used to load queries
 * from the returned `preloadQuery` function.
 * @returns The {@link preloadQuery} function.
 *
 * @example
 * ```js
 * const preloadQuery = createQueryPreloader(client);
 * ```
 */
export function createQueryPreloader(
  client: ApolloClient<any>
): PreloadQueryFunction {
  /**
   * A function that will begin loading a query when called. It's result can be
   * read by {@link useReadQuery} which will suspend until the query is loaded.
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
  return function preloadQuery<
    TData = unknown,
    TVariables extends OperationVariables = OperationVariables,
  >(
    query: DocumentNode | TypedDocumentNode<TData, TVariables>,
    options: PreloadQueryOptions<NoInfer<TVariables>> &
      VariablesOption<TVariables> = Object.create(null)
  ): QueryReference<TData, TVariables> {
    const { variables, ...watchQueryOptions } = options;

    const observable = client.watchQuery({
      ...watchQueryOptions,
      query,
      variables,
    } as WatchQueryOptions<any, any>);

    const queryRef = new InternalQueryReference(observable, {
      autoDisposeTimeoutMs:
        client.defaultOptions.react?.suspense?.autoDisposeTimeoutMs,
    });

    return wrapQueryRef(queryRef);
  };
}
