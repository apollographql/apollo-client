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
  TOptions extends Partial<OptionsUnion<any, any, any>>
>(
  defaults: TOptions | Partial<TOptions> | undefined,
  options: TOptions | Partial<TOptions>,
): TOptions {
  return compact(defaults, options, options.variables && {
    variables: {
      ...(defaults && defaults.variables),
      ...options.variables,
    },
  });
}
