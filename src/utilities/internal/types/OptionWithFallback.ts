import type { RemoveIndexSignature } from "./RemoveIndexSignature.js";

type ReplaceUndefinedWithDefault<Value, Default> =
  Value extends any ?
    Value extends undefined ?
      Default
    : Value
  : never;

export type OptionWithFallback<
  Options,
  DefaultOptions,
  Key extends keyof DefaultOptions,
> = Key extends keyof RemoveIndexSignature<Options> ?
  ReplaceUndefinedWithDefault<Options[Key], DefaultOptions[Key]>
: DefaultOptions[Key];
