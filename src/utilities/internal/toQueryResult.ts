import type { ApolloClient, ObservableQuery } from "@apollo/client";

/** @internal */
export function toQueryResult<TData = unknown>(
  value: ObservableQuery.Result<TData>
) {
  const result: ApolloClient.QueryResult<TData> = {
    data: value.data as TData | undefined,
  };

  if (value.error) {
    result.error = value.error;
  }

  return result;
}
