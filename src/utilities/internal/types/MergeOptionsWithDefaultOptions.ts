export type MergeOptionsWithDefaultOptions<Options, DefaultOptions> = {
  [K in keyof DefaultOptions]-?: Options extends { [P in K]?: infer V } ?
    undefined extends V ?
      // even if explicitly specified, in the `undefined` case we still fall back to the default
      DefaultOptions[K] | Exclude<V, undefined>
    : V
  : DefaultOptions[K];
} & Omit<Options, keyof DefaultOptions>;
