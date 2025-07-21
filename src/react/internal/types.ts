import type {
  ApolloClient,
  MaybeMasked,
  ObservableQuery,
  OperationVariables,
} from "@apollo/client";

export type RefetchFunction<TData, TVariables extends OperationVariables> = (
  variables?: Partial<TVariables>
) => Promise<ApolloClient.QueryResult<TData>>;

export type FetchMoreFunction<TData, TVariables extends OperationVariables> = <
  TFetchData = TData,
  TFetchVars extends OperationVariables = TVariables,
>(
  fetchMoreOptions: ObservableQuery.FetchMoreOptions<
    TData,
    TVariables,
    TFetchData,
    TFetchVars
  >
) => Promise<ApolloClient.QueryResult<MaybeMasked<TData>>>;
