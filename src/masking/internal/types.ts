import type { Prettify, UnionToIntersection } from "../../utilities/index.js";
import type { DataMasking } from "../types.js";

/** @internal */
export type Unmask<TData> =
  {} extends TData ? TData
  : TData extends object ?
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
          [K in keyof TData as K extends " $fragmentRefs" ? never
          : K]: UnwrapFragmentRefs<TData[K]>;
        } & CombineFragmentRefs<FragmentRefs>
      >
    : never
  : TData extends object ? { [K in keyof TData]: UnwrapFragmentRefs<TData[K]> }
  : TData extends Array<infer TItem> ? UnwrapFragmentRefs<TItem>
  : TData;

type CombineFragmentRefs<FragmentRefs extends Record<string, any>> =
  UnionToIntersection<
    {
      [K in keyof FragmentRefs]-?: RemoveFragmentName<FragmentRefs[K]>;
    }[keyof FragmentRefs]
  >;

type RemoveMaskedMarker<T> = Omit<T, "__masked">;
// force distrubution when T is a union with | undefined
type RemoveFragmentName<T> = T extends any ? Omit<T, " $fragmentName"> : T;
