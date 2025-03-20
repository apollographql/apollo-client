import type { OperationVariables } from "@apollo/client/core";
import type { useLazyQuery, useQuery } from "@apollo/client/react/hooks";

/** @deprecated Use `useQuery.Options` instead */
export type QueryHookOptions<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
> = useQuery.Options<TData, TVariables>;

/** @deprecated Use `useQuery.Result` instead */
export type QueryResult<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
> = useQuery.Result<TData, TVariables>;

/** @deprecated Use `useLazyQuery.Options` instead */
export type LazyQueryHookOptions<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
> = useLazyQuery.Options<TData, TVariables>;

/** @deprecated Use `useLazyQuery.Result` instead */
export type LazyQueryResult<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
> = useLazyQuery.Result<TData, TVariables>;

/** @deprecated Use `useLazyQuery.ResultTuple` instead */
export type LazyQueryResultTuple<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
> = useLazyQuery.ResultTuple<TData, TVariables>;

/** @deprecated Use `useLazyQuery.ExecOptions` instead */
export type LazyQueryHookExecOptions<
  TVariables extends OperationVariables = OperationVariables,
> = useLazyQuery.ExecOptions<TVariables>;

/** @deprecated Use `useLazyQuery.ExecOptions` instead */
export type LazyQueryExecFunction<
  TData = unknown,
  TVariables extends OperationVariables = OperationVariables,
> = useLazyQuery.ExecFunction<TData, TVariables>;
