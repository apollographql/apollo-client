import type { ApolloQueryResult, QueryResult } from "@apollo/client";

/** @internal */
export function toQueryResult<TData = unknown>(
  value: ApolloQueryResult<TData>
) {
  const result: QueryResult<TData> = {
    data: value.data as TData | undefined,
  };

  if (value.error) {
    result.error = value.error;
  }

  return result;
}
