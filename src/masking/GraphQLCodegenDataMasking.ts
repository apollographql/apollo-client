import type { TypedDocumentNode } from "@graphql-typed-document-node/core";

import type { DataMasking } from "@apollo/client";
import type { HKT } from "@apollo/client/utilities";
import type { IsAny, Prettify } from "@apollo/client/utilities/internal";

import type {
  ContainsFragmentsRefs,
  RemoveFragmentName,
  RemoveMaskedMarker,
  UnwrapFragmentRefs,
} from "./internal/types.js";

export namespace GraphQLCodegenDataMasking {
  export interface Implementation {
    Masked: HKTImplementation.Masked;
    MaskedDocumentNode: HKTImplementation.MaskedDocumentNode;
    FragmentType: HKTImplementation.FragmentType;
    MaybeMasked: HKTImplementation.MaybeMasked;
    Unmasked: HKTImplementation.Unmasked;
  }
  namespace HKTImplementation {
    export interface Masked extends HKT {
      arg1: unknown; // TData
      return: GraphQLCodegenDataMasking.Masked<this["arg1"]>;
    }

    export interface MaskedDocumentNode extends HKT {
      arg1: unknown; // TData
      arg2: unknown; // TVariables
      return: GraphQLCodegenDataMasking.MaskedDocumentNode<
        this["arg1"],
        this["arg2"]
      >;
    }

    export interface FragmentType extends HKT {
      arg1: unknown; // TData
      return: GraphQLCodegenDataMasking.FragmentType<this["arg1"]>;
    }

    export interface MaybeMasked extends HKT {
      arg1: unknown; // TData
      return: GraphQLCodegenDataMasking.MaybeMasked<this["arg1"]>;
    }

    export interface Unmasked extends HKT {
      arg1: unknown; // TData
      return: GraphQLCodegenDataMasking.Unmasked<this["arg1"]>;
    }
  }

  /**
   * Marks a type as masked. This is used by `MaybeMasked` when determining
   * whether to use the masked or unmasked type.
   */
  export type Masked<TData> = TData & {
    __masked?: true;
  };

  /**
   * Marks a type as masked. This is a shortcut for
   * `TypedDocumentNode<Masked<TData>, TVariables>`
   */
  export type MaskedDocumentNode<
    TData = { [key: string]: any },
    TVariables = { [key: string]: any },
  > = TypedDocumentNode<Masked<TData>, TVariables>;

  export type FragmentType<TData> =
    [TData] extends [{ " $fragmentName"?: infer TKey }] ?
      TKey extends string ?
        { " $fragmentRefs"?: { [key in TKey]: TData } }
      : never
    : never;

  /**
   * Returns TData as either masked or unmasked depending on whether masking is
   * enabled.
   */
  export type MaybeMasked<TData> =
    DataMasking extends { mode: "unmask" } ?
      // distribute TData - in case of a union, do the next steps for each member
      TData extends any ?
        // prevent "Type instantiation is excessively deep and possibly infinite."
        true extends IsAny<TData> ? TData
        : TData extends { __masked?: true } ?
          Prettify<RemoveMaskedMarker<TData>>
        : Unmasked<TData>
      : never
    : DataMasking extends { mode: "preserveTypes" } ? TData
    : TData;

  /**
   * Unmasks a type to provide its full result.
   */
  export type Unmasked<TData> =
    true extends IsAny<TData> ? TData
    : TData extends object ?
      true extends ContainsFragmentsRefs<TData> ?
        UnwrapFragmentRefs<RemoveMaskedMarker<RemoveFragmentName<TData>>>
      : TData
    : TData;
}
