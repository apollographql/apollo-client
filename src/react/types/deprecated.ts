import type {
  ApolloCache,
  DefaultContext,
  OperationVariables,
} from "@apollo/client/core";
import type {
  useLazyQuery,
  useMutation,
  useQuery,
} from "@apollo/client/react/hooks";

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

/** @deprecated Use `useMutation.Options` instead */
export type MutationHookOptions<
  TData = unknown,
  TVariables = OperationVariables,
  TContext = DefaultContext,
  TCache extends ApolloCache = ApolloCache,
> = useMutation.Options<TData, TVariables, TContext, TCache>;

/** @deprecated Use `useMutation.Result` instead */
export type MutationResult<TData = unknown> = useMutation.Result<TData>;

/** @deprecated Use `useMutation.MutationFunctionOptions` instead */
export type MutationFunctionOptions<
  TData = unknown,
  TVariables = OperationVariables,
  TContext = DefaultContext,
  TCache extends ApolloCache = ApolloCache,
> = useMutation.MutationFunctionOptions<TData, TVariables, TContext, TCache>;

/** @deprecated Use `useMutation.ResultTuple` instead */
export type MutationTuple<
  TData,
  TVariables,
  TContext = DefaultContext,
  TCache extends ApolloCache = ApolloCache,
> = useMutation.ResultTuple<TData, TVariables, TContext, TCache>;
