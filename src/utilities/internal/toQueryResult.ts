import type { ApolloQueryResult, QueryResult } from "@apollo/client";

export function toQueryResult<TData = unknown>(
  value: ApolloQueryResult<TData>
) {
  const result: QueryResult<TData> = {
    data: value.data,
  };

  if (value.error) {
    result.error = value.error;
  }

  return result;
}
