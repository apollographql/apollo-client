import type { DataMasking } from "../../masking/index.js";

/** @internal */
export type ApplyMasking<TData> =
  TData extends { __masked?: true } ?
    RemoveFragmentRefs<Omit<TData, "__masked">>
  : DataMasking extends { enabled: true } ? RemoveFragmentRefs<TData>
  : TData;

type RemoveFragmentRefs<TData> =
  TData extends object ?
    {
      [K in keyof TData as K extends " $fragmentRefs" ? never
      : K]: RemoveFragmentRefs<TData[K]>;
    }
  : TData extends Array<infer TItem> ? Array<RemoveFragmentRefs<TItem>>
  : TData;
