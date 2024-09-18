import type { DataMasking } from "../../masking/index.js";

/** @internal */
export type ApplyMasking<TData> =
  TData extends { __masked?: true } ? RemoveMaskedMarkers<TData>
  : DataMasking extends { enabled: true } ? RemoveMaskedMarkers<TData>
  : Unmask<TData>;

/** @internal */
export type Unmask<TData> =
  TData extends { " $unmasked": infer TUnmaskedData } ? TUnmaskedData : TData;

type RemoveMaskedMarkers<TData> = Omit<TData, "__masked" | " $unmasked">;
