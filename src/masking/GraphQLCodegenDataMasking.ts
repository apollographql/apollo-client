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
    Mask: HKTImplementation.Mask;
    Unmask: HKTImplementation.Unmask;
  }
  namespace HKTImplementation {
    export interface FragmentType extends HKT {
      arg1: unknown; // TData
      return: GraphQLCodegenDataMasking.FragmentType<this["arg1"]>;
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
