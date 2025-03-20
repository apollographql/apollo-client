import type { OperationVariables } from "@apollo/client/core";
import type { useQuery } from "@apollo/client/react/hooks";

/** @deprecated Use `useQuery.Result` instead */
export type QueryResult<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
> = useQuery.Result<TData, TVariables>;

/** @deprecated Use `useQuery.options` instead */
export type QueryHookOptions<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
> = useQuery.Options<TData, TVariables>;
