import type { fragmentVariablesSymbol } from "@apollo/client/utilities/internal";

export type WithFragmentInfo<T> =
  T extends Array<infer TItem> ? Array<WithFragmentInfo<TItem>>
  : T extends ReadonlyArray<infer TItem> ?
    ReadonlyArray<WithFragmentInfo<TItem>>
  : T extends object ?
    { [K in keyof T]: WithFragmentInfo<T[K]> } & {
      [fragmentVariablesSymbol]?: Record<string, Record<string, unknown>>;
    }
  : T;
