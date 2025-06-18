import type {
  FetchMoreOptions,
  MaybeMasked,
  OperationVariables,
  QueryResult,
} from "@apollo/client";

export type RefetchFunction<TData, TVariables extends OperationVariables> = (
  variables?: Partial<TVariables>
) => Promise<QueryResult<TData>>;

export type FetchMoreFunction<TData, TVariables extends OperationVariables> = (
  fetchMoreOptions: FetchMoreOptions<TData, TVariables>
) => Promise<QueryResult<MaybeMasked<TData>>>;
