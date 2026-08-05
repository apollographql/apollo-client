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
) => Promise<ApolloClient.QueryResult<MaybeMasked<TData>, TErrorPolicy>>;

export type FetchMoreFunction<TData, TVariables extends OperationVariables> = <
  TFetchData = TData,
  TFetchVars extends OperationVariables = TVariables,
  TErrorPolicy extends ErrorPolicy = "none",
>(
  fetchMoreOptions: ObservableQuery.FetchMoreOptions<
    TData,
    TVariables,
    TFetchData,
    TFetchVars
  > & {
    /** {@inheritDoc @apollo/client!QueryOptionsDocumentation#errorPolicy:member} */
    errorPolicy?: TErrorPolicy;
  }
) => Promise<ApolloClient.QueryResult<MaybeMasked<TFetchData>, TErrorPolicy>>;
