import type { Prettify, UnionToIntersection } from "../../utilities/index.js";

export type UnwrapFragmentRefs<TData> =
  // Leave TData alone if it is Record<string, any> and not a specific shape
  string extends keyof NonNullable<TData> ? TData
  : " $fragmentRefs" extends keyof NonNullable<TData> ?
    TData extends { " $fragmentRefs"?: infer FragmentRefs extends object } ?
      Prettify<
        {
          [K in keyof TData as K extends " $fragmentRefs" ? never
          : K]: UnwrapFragmentRefs<TData[K]>;
        } & CombineFragmentRefs<FragmentRefs>
      >
    : never
  : TData extends object ? { [K in keyof TData]: UnwrapFragmentRefs<TData[K]> }
  : TData;

type CombineFragmentRefs<FragmentRefs extends Record<string, any>> =
  UnionToIntersection<
    {
      [K in keyof FragmentRefs]-?: UnwrapFragmentRefs<
        RemoveFragmentName<FragmentRefs[K]>
      >;
    }[keyof FragmentRefs]
  >;

export type RemoveMaskedMarker<T> = Omit<T, "__masked">;
// force distrubution when T is a union with | undefined
export type RemoveFragmentName<T> =
  T extends any ? Omit<T, " $fragmentName"> : T;
