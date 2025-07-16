import type {
  FetchMoreOptions,
  MaybeMasked,
  OperationVariables,
  QueryResult,
} from "@apollo/client";

export type RefetchFunction<TData, TVariables extends OperationVariables> = (
  variables?: Partial<TVariables>
) => Promise<QueryResult<TData>>;

export type FetchMoreFunction<TData, TVariables extends OperationVariables> = <
  TFetchData = TData,
  TFetchVars extends OperationVariables = TVariables,
>(
  fetchMoreOptions: FetchMoreOptions<TData, TVariables, TFetchData, TFetchVars>
) => Promise<QueryResult<MaybeMasked<TData>>>;
