import type { Prettify } from "../../utilities/index.js";
import type { DataMasking } from "../types.js";

/** @internal */
export type Unmask<TData> =
  TData extends { " $unmasked": infer TUnmaskedData } ? TUnmaskedData : TData;

/** @internal */
export type MaybeMasked<TData> =
  TData extends { __masked?: true } ? RemoveMaskedMarkers<TData>
  : DataMasking extends { enabled: true } ? RemoveMaskedMarkers<TData>
  : Unmask<TData>;

type RemoveMaskedMarkers<TData> = Prettify<
  Omit<TData, "__masked" | " $unmasked">
>;
