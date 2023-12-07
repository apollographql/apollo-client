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
import { canonicalStringify } from "../../utilities/index.js";
import type {
  DeepPartial,
  OnlyRequiredProperties,
} from "../../utilities/index.js";
import { wrapQueryRef } from "../cache/QueryReference.js";
import type { QueryReference } from "../cache/QueryReference.js";
import { getSuspenseCache } from "../cache/getSuspenseCache.js";
import type { CacheKey } from "../cache/types.js";
import type { NoInfer } from "../index.js";

type VariablesOption<TVariables extends OperationVariables> =
  [TVariables] extends [never] ? { variables?: never }
  : {} extends OnlyRequiredProperties<TVariables> ? { variables?: TVariables }
  : { variables: TVariables };

export type PreloadQueryFetchPolicy = Extract<
  WatchQueryFetchPolicy,
  "cache-first" | "network-only" | "no-cache" | "cache-and-network"
>;

export type PreloadQueryOptions<
  TVariables extends OperationVariables = OperationVariables,
> = {
  canonizeResults?: boolean;
  context?: DefaultContext;
  errorPolicy?: ErrorPolicy;
  fetchPolicy?: PreloadQueryFetchPolicy;
  queryKey?: string | number | any[];
  returnPartialData?: boolean;
  refetchWritePolicy?: RefetchWritePolicy;
} & VariablesOption<TVariables>;

type PreloadQueryOptionsArg<
  TVariables extends OperationVariables,
  TOptions = unknown,
> = [TVariables] extends [never] ?
  [options?: PreloadQueryOptions<never> & TOptions]
: {} extends OnlyRequiredProperties<TVariables> ?
  [options?: PreloadQueryOptions<NoInfer<TVariables>> & TOptions]
: [options: PreloadQueryOptions<NoInfer<TVariables>> & TOptions];

export function createQueryPreloader(client: ApolloClient<any>) {
  const suspenseCache = getSuspenseCache(client);

  function preloadQuery<
    TData,
    TVariables extends OperationVariables,
    TOptions extends Omit<PreloadQueryOptions<never>, "variables">,
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

  function preloadQuery<
    TData = unknown,
    TVariables extends OperationVariables = OperationVariables,
  >(
    query: DocumentNode | TypedDocumentNode<TData, TVariables>,
    options: PreloadQueryOptions & {
      returnPartialData: true;
      errorPolicy: "ignore" | "all";
    }
  ): QueryReference<DeepPartial<TData> | undefined, TVariables>;

  function preloadQuery<
    TData = unknown,
    TVariables extends OperationVariables = OperationVariables,
  >(
    query: DocumentNode | TypedDocumentNode<TData, TVariables>,
    options: PreloadQueryOptions<NoInfer<TVariables>> & {
      errorPolicy: "ignore" | "all";
    }
  ): QueryReference<TData | undefined, TVariables>;

  function preloadQuery<
    TData = unknown,
    TVariables extends OperationVariables = OperationVariables,
  >(
    query: DocumentNode | TypedDocumentNode<TData, TVariables>,
    options: PreloadQueryOptions & {
      returnPartialData: true;
    }
  ): QueryReference<DeepPartial<TData>, TVariables>;

  function preloadQuery<
    TData = unknown,
    TVariables extends OperationVariables = OperationVariables,
  >(
    query: DocumentNode | TypedDocumentNode<TData, TVariables>,
    ...[options]: PreloadQueryOptionsArg<NoInfer<TVariables>>
  ): QueryReference<TData, TVariables>;

  function preloadQuery<
    TData = unknown,
    TVariables extends OperationVariables = OperationVariables,
  >(
    query: DocumentNode | TypedDocumentNode<TData, TVariables>,
    options: PreloadQueryOptions & VariablesOption<TVariables> = Object.create(
      null
    )
  ): QueryReference<TData, TVariables> {
    const { variables, queryKey = [], ...watchQueryOptions } = options;

    const cacheKey: CacheKey = [
      query,
      canonicalStringify(variables),
      ...([] as any[]).concat(queryKey),
    ];

    const queryRef = suspenseCache.getQueryRef(cacheKey, () =>
      client.watchQuery({
        query,
        variables,
        ...watchQueryOptions,
      } as WatchQueryOptions<any, any>)
    );

    return wrapQueryRef(queryRef);
  }

  return preloadQuery;
}