import type { HKT } from "@apollo/client/utilities";

export declare namespace PreserveTypes {
  export interface TypeOverrides {
    FragmentType: HKTImplementation.FragmentType;
    MaybeMasked: HKTImplementation.MaybeMasked;
    Unmasked: HKTImplementation.Unmasked;
  }
  namespace HKTImplementation {
    export interface FragmentType extends HKT {
      arg1: unknown; // TData
      return: never;
    }

    export interface MaybeMasked extends HKT {
      arg1: unknown; // TData
      return: this["arg1"];
    }

    export interface Unmasked extends HKT {
      arg1: unknown; // TData
      return: this["arg1"];
    }
  }

  export type FragmentType<_TData> = never;
  export type MaybeMasked<TData> = TData;
  export type Unmasked<TData> = TData;
}
