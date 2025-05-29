import type {
  FetchMoreQueryOptions,
  MaybeMasked,
  ObservableQuery,
  OperationVariables,
  QueryResult,
  Unmasked,
} from "@apollo/client";

export type RefetchFunction<
  TData,
  TVariables extends OperationVariables,
> = ObservableQuery<TData, TVariables>["refetch"];

export type FetchMoreFunction<TData, TVariables extends OperationVariables> = (
  fetchMoreOptions: FetchMoreQueryOptions<TVariables, TData> & {
    updateQuery?: (
      previousQueryResult: Unmasked<TData>,
      options: {
        fetchMoreResult: Unmasked<TData>;
        variables: TVariables;
      }
    ) => Unmasked<TData>;
  }
) => Promise<QueryResult<MaybeMasked<TData>>>;
