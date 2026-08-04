import type {
  ApolloClient,
  ErrorPolicy,
  MaybeMasked,
  ObservableQuery,
  OperationVariables,
} from "@apollo/client";

export type RefetchFunction<
  TData,
  TVariables extends OperationVariables,
  TErrorPolicy extends ErrorPolicy | undefined = undefined,
> = (
  variables?: Partial<TVariables>
) => Promise<ApolloClient.QueryResult<TData, TErrorPolicy>>;

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
