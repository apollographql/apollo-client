import type {
  FetchMoreQueryOptions,
  MaybeMasked,
  OperationVariables,
  QueryResult,
  Unmasked,
} from "@apollo/client";

export type RefetchFunction<TData, TVariables extends OperationVariables> = (
  variables?: Partial<TVariables>
) => Promise<QueryResult<TData>>;

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
