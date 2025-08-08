import type { HKT } from "@apollo/client/utilities";

export declare namespace PreserveTypes {
  export interface Implementation {
    FragmentType: HKTImplementation.FragmentType;
    IsMaskingEnabled: HKTImplementation.IsMaskingEnabled;
    Mask: HKTImplementation.Mask;
    Unmask: HKTImplementation.Unmask;
  }
  namespace HKTImplementation {
    export interface FragmentType extends HKT {
      arg1: unknown; // TData
      return: PreserveTypes.FragmentType<this["arg1"]>;
    }

    export interface IsMaskingEnabled extends HKT {
      arg1: unknown; // TData
      return: PreserveTypes.IsMaskingEnabled<this["arg1"]>;
    }

    export interface Mask extends HKT {
      arg1: unknown; // TData
      return: PreserveTypes.Mask<this["arg1"]>;
    }

    export interface Unmask extends HKT {
      arg1: unknown; // TData
      return: PreserveTypes.Unmask<this["arg1"]>;
    }
  }

  export type IsMaskingEnabled<_TData> = false;
  export type FragmentType<_TData> = never;
  export type Mask<TData> = TData;
  export type Unmask<TData> = TData;
}
