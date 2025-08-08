import type { HKT } from "@apollo/client/utilities";
import type { IsAny } from "@apollo/client/utilities/internal";

import type {
  ContainsFragmentsRefs,
  RemoveFragmentName,
  UnwrapFragmentRefs,
} from "./internal/types.js";
export declare namespace GraphQLCodegenDataMasking {
  export interface Implementation {
    FragmentType: HKTImplementation.FragmentType;
    IsMaskingEnabled: HKTImplementation.IsMaskingEnabled;
    Mask: HKTImplementation.Mask;
    Unmask: HKTImplementation.Unmask;
  }
  namespace HKTImplementation {
    export interface FragmentType extends HKT {
      arg1: unknown; // TData
      return: GraphQLCodegenDataMasking.FragmentType<this["arg1"]>;
    }

    export interface IsMaskingEnabled extends HKT {
      arg1: unknown; // TData
      return: GraphQLCodegenDataMasking.IsMaskingEnabled<this["arg1"]>;
    }

    export interface Mask extends HKT {
      arg1: unknown; // TData
      return: GraphQLCodegenDataMasking.Mask<this["arg1"]>;
    }

    export interface Unmask extends HKT {
      arg1: unknown; // TData
      return: GraphQLCodegenDataMasking.Unmask<this["arg1"]>;
    }
  }

  export type FragmentType<TData> =
    [TData] extends [{ " $fragmentName"?: infer TKey }] ?
      TKey extends string ?
        { " $fragmentRefs"?: { [key in TKey]: TData } }
      : never
    : never;

  /**
   * Determines if masking is enabled
   *
   * @remarks
   * GraphQL Codegen always generates masked types. This implementation assumes
   * masking is enabled simply by using this module.
   */
  export type IsMaskingEnabled<_TData> = true;

  /**
   * GraphQL Codegen generates types as masked types, so this is an identity
   * type.
   */
  export type Mask<TData> = TData;

  /**
   * Unmasks a type to provide its full result.
   */
  export type Unmask<TData> =
    true extends IsAny<TData> ? TData
    : TData extends object ?
      true extends ContainsFragmentsRefs<TData> ?
        UnwrapFragmentRefs<RemoveFragmentName<TData>>
      : TData
    : TData;
}
