import type {
  QueryOptions,
  WatchQueryOptions,
  MutationOptions,
  OperationVariables,
} from "../../core/index.js";

import { compact } from "./compact.js";

type OptionsUnion<TData, TVariables extends OperationVariables, TContext> =
  | WatchQueryOptions<TVariables, TData>
  | QueryOptions<TVariables, TData>
  | MutationOptions<TData, TVariables, TContext, any>;

export function mergeOptions<
  TDefaultOptions extends Partial<OptionsUnion<any, any, any>>,
  TOptions extends TDefaultOptions,
>(
  defaults: TDefaultOptions | Partial<TDefaultOptions> | undefined,
  options: TOptions | Partial<TOptions>
): TOptions & TDefaultOptions {
  return compact(
    defaults,
    options,
    options.variables && {
      variables: compact({
        ...(defaults && defaults.variables),
        ...options.variables,
      }),
    }
  );
}
