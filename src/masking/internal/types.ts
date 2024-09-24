import type { Prettify } from "../../utilities/index.js";
import type { DataMasking } from "../types.js";

/** @internal */
export type Unmasked<TData> =
  TData extends object ?
    Prettify<UnwrapFragmentRefs<RemoveMaskedMarker<RemoveFragmentName<TData>>>>
  : TData;

/** @internal */
export type MaybeMasked<TData> =
  TData extends { __masked?: true } ? Prettify<RemoveMaskedMarker<TData>>
  : DataMasking extends { enabled: true } ? TData
  : Unmasked<TData>;

type UnwrapFragmentRefs<TData> =
  // Leave TData alone if it is Record<string, any> and not a specific shape
  string extends keyof NonNullable<TData> ? TData
  : TData extends Array<infer U> ? Array<UnwrapFragmentRefs<U>>
  : " $fragmentRefs" extends keyof NonNullable<TData> ?
    {
      [K in Exclude<keyof TData, " $fragmentRefs">]: UnwrapFragmentRefs<
        TData[K]
      >;
    } & UnwrapFragmentRefs<
      Combine<KeyTuples<NonNullable<TData[" $fragmentRefs" & keyof TData]>>>
    >
  : TData extends object ? { [K in keyof TData]: UnwrapFragmentRefs<TData[K]> }
  : TData;

type RemoveMaskedMarker<T> = Omit<T, "__masked">;
// force distrubution when T is a union with | undefined
type RemoveFragmentName<T> = T extends any ? Omit<T, " $fragmentName"> : T;

type KeyTuples<T> =
  T[keyof T] extends infer V ?
    V extends any ?
      keyof V extends infer K ?
        K extends keyof V ?
          K extends " $fragmentRefs" ? KeyTuples<NonNullable<V[K]>>
          : K extends " $fragmentName" ? never
          : [K, V[K]]
        : never
      : never
    : never
  : never;

type Combine<Tuple extends [string, any]> = {
  [P in Tuple as P[0]]: P[1];
};
