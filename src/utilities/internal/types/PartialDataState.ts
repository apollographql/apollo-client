import type { OptionWithFallback } from "./OptionWithFallback.js";

/** @internal */
export type PartialDataState<
  Options,
  DefaultOptions extends { returnPartialData: boolean; fetchPolicy?: unknown },
> = OptionWithFallback<Options, DefaultOptions, "returnPartialData"> extends (
  false
) ?
  never
: OptionWithFallback<Options, DefaultOptions, "fetchPolicy"> extends (
  "no-cache"
) ?
  never
: "partial";
