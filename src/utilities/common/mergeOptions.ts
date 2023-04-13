import type {
  QueryOptions,
  WatchQueryOptions,
  MutationOptions,
  OperationVariables,
} from "../../core";

import { compact } from "./compact";

type OptionsUnion<TData, TVariables extends OperationVariables, TContext> =
  | WatchQueryOptions<TVariables, TData>
  | QueryOptions<TVariables, TData>
  | MutationOptions<TData, TVariables, TContext>;

export function mergeOptions<
  TDefaultOptions extends Partial<OptionsUnion<any, any, any>>,
  TOptions extends TDefaultOptions
>(
  defaults: TDefaultOptions | Partial<TDefaultOptions> | undefined,
  options: TOptions | Partial<TOptions>,
): TOptions & TDefaultOptions {
  return compact(defaults, options, options.variables && {
    variables: compact({
      ...(defaults && defaults.variables),
      ...options.variables,
    }),
  });
}
