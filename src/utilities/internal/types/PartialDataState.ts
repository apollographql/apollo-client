import type { OptionWithFallback } from "./OptionWithFallback.js";

type DefaultFetchPolicy<DefaultOptions> =
  "fetchPolicy" extends keyof DefaultOptions ? DefaultOptions["fetchPolicy"]
  : "cache-first";

/** @internal */
export type PartialDataState<
  Options,
  DefaultOptions extends { returnPartialData: boolean },
> = OptionWithFallback<Options, DefaultOptions, "returnPartialData"> extends (
  false
) ?
  never
: OptionWithFallback<
  Options,
  { fetchPolicy: DefaultFetchPolicy<DefaultOptions> },
  "fetchPolicy"
> extends "no-cache" ?
  never
: "partial";
