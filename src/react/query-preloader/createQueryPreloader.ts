import type {
  ApolloClient,
  DefaultContext,
  DocumentNode,
  ErrorPolicy,
  FetchMoreQueryOptions,
  OperationVariables,
  RefetchWritePolicy,
  TypedDocumentNode,
  WatchQueryFetchPolicy,
  WatchQueryOptions,
} from "../../core/index.js";
import { canonicalStringify } from "../../utilities/index.js";
import type { OnlyRequiredProperties } from "../../utilities/index.js";
import { wrapQueryRef } from "../cache/QueryReference.js";
import type { QueryReference } from "../cache/QueryReference.js";
import { getSuspenseCache } from "../cache/getSuspenseCache.js";
import type { CacheKey } from "../cache/types.js";
import type {
  FetchMoreFunction,
  RefetchFunction,
} from "../hooks/useSuspenseQuery.js";
import type { NoInfer } from "../index.js";

type VariablesOption<TVariables extends OperationVariables> = [
  TVariables,
] extends [never]
  ? { variables?: never }
  : {} extends OnlyRequiredProperties<TVariables>
  ? { variables?: TVariables }
  : { variables: TVariables };

export type PreloadQueryFetchPolicy = Extract<
  WatchQueryFetchPolicy,
  "cache-first" | "network-only" | "no-cache" | "cache-and-network"
>;

export type PreloadQueryOptions<
  TData,
  TVariables extends OperationVariables,
> = {
  query: DocumentNode | TypedDocumentNode<TData, TVariables>;
  canonizeResults?: boolean;
  context?: DefaultContext;
  errorPolicy?: ErrorPolicy;
  fetchPolicy?: PreloadQueryFetchPolicy;
  queryKey?: string | number | any[];
  returnPartialData?: boolean;
  refetchWritePolicy?: RefetchWritePolicy;
} & VariablesOption<NoInfer<TVariables>>;

export type PreloadedQueryResult<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
> = [
  QueryReference<TData>,
  {
    dispose: () => void;
    fetchMore: FetchMoreFunction<TData, TVariables>;
    refetch: RefetchFunction<TData, TVariables>;
  },
];

export function createQueryPreloader(client: ApolloClient<any>) {
  const suspenseCache = getSuspenseCache(client);

  return function preloadQuery<
    TData = unknown,
    TVariables extends OperationVariables = OperationVariables,
  >(
    options: PreloadQueryOptions<TData, TVariables>
  ): PreloadedQueryResult<TData, TVariables> {
    const { query, variables, queryKey, ...watchQueryOptions } = options;

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

    const fetchMore: FetchMoreFunction<TData, TVariables> = (options) => {
      return queryRef.fetchMore(options as FetchMoreQueryOptions<any>);
    };

    const refetch: RefetchFunction<TData, TVariables> = (variables) => {
      return queryRef.refetch(variables);
    };

    const dispose = queryRef.retain();

    return [wrapQueryRef(queryRef), { fetchMore, refetch, dispose }];
  };
}
