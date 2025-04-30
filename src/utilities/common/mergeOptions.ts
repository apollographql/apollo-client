import type {
  MutationOptions,
  OperationVariables,
  QueryOptions,
  WatchQueryOptions,
} from "@apollo/client";
import { compact } from "@apollo/client/utilities/internal";

type OptionsUnion<TData, TVariables extends OperationVariables> =
  | WatchQueryOptions<TVariables, TData>
  | QueryOptions<TVariables, TData>
  | MutationOptions<TData, TVariables, any>;

export function mergeOptions<
  TDefaultOptions extends Partial<OptionsUnion<any, any>>,
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
