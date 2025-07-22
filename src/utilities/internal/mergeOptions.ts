import type { ApolloClient, OperationVariables } from "@apollo/client";

import { compact } from "./compact.js";

type OptionsUnion<TData, TVariables extends OperationVariables> =
  | ApolloClient.WatchQueryOptions<TData, TVariables>
  | ApolloClient.QueryOptions<TData, TVariables>
  | ApolloClient.MutateOptions<TData, TVariables, any>;

/** @internal */
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
