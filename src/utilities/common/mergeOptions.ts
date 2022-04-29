import type {
  QueryOptions,
  WatchQueryOptions,
  MutationOptions,
} from "../../core";

import { compact } from "./compact";

type OptionsUnion<TData, TVariables, TContext> =
  | WatchQueryOptions<TVariables, TData>
  | QueryOptions<TVariables, TData>
  | MutationOptions<TData, TVariables, TContext>;

export function mergeOptions<
  TOptions extends OptionsUnion<any, any, any>
>(
  defaults: TOptions | Partial<TOptions>,
  options: TOptions | Partial<TOptions>,
): TOptions {
  return compact(defaults, options, options.variables && {
    variables: {
      ...defaults.variables,
      ...options.variables,
    },
  });
}
