import type { Prettify, UnionToIntersection } from "../../utilities/index.js";
import type { DataMasking } from "../types.js";

/** @internal */
export type Unmask<TData> =
  TData extends object ?
    UnwrapFragmentRefs<RemoveMaskedMarker<RemoveFragmentName<TData>>>
  : TData;

/** @internal */
export type MaybeMasked<TData> =
  TData extends { __masked?: true } ? Prettify<RemoveMaskedMarker<TData>>
  : DataMasking extends { enabled: true } ? TData
  : Unmask<TData>;

type UnwrapFragmentRefs<TData> =
  TData extends { " $fragmentRefs"?: infer FragmentRefs } ?
    FragmentRefs extends Record<string, any> ?
      Prettify<
        {
          [K in Exclude<keyof TData, " $fragmentRefs">]: UnwrapFragmentRefs<
            TData[K]
          >;
        } & CombineFragmentRefs<FragmentRefs>
      >
    : never
  : TData extends object ? { [K in keyof TData]: UnwrapFragmentRefs<TData[K]> }
  : TData extends Array<infer TItem> ? UnwrapFragmentRefs<TItem>
  : TData;

type CombineFragmentRefs<FragmentRefMap extends Record<string, any>> =
  UnionToIntersection<
    {
      [K in keyof FragmentRefMap]: RemoveFragmentName<FragmentRefMap[K]>;
    }[keyof FragmentRefMap]
  >;

type RemoveMaskedMarker<T> = Omit<T, "__masked">;
type RemoveFragmentName<T> = Omit<T, " $fragmentName">;
