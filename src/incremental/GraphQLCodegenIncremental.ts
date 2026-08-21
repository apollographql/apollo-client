import type { DeepPartial, HKT } from "@apollo/client/utilities";
import type { IsAny } from "@apollo/client/utilities/internal";

import type {
  ContainsNeverishFields,
  RemoveNeverishFields,
} from "./internal/types.js";

export declare namespace GraphQLCodegenIncremental {
  export interface TypeOverrides {
    Complete: HKTImplementation.Complete;
    Streaming: HKTImplementation.Streaming;
    Partial: HKTImplementation.Partial;
  }

  namespace HKTImplementation {
    export interface Complete extends HKT {
      arg1: unknown; // TData
      return: GraphQLCodegenIncremental.Complete<this["arg1"]>;
    }

    export interface Streaming extends HKT {
      arg1: unknown; // TData
      return: GraphQLCodegenIncremental.Streaming<this["arg1"]>;
    }

    export interface Partial extends HKT {
      arg1: unknown; // TData
      return: GraphQLCodegenIncremental.Partial<this["arg1"]>;
    }
  }

  /**
   * Returns the complete representation of `TData` when `dataState` is
   * `"complete"`.
   *
   * @remarks
   * GraphQL Codegen types deferred fields as a union of the present value and
   * `{ field?: never }`. `complete` `dataState` means every field in the
   * selection set is reachable, so this type drops the `never` branches.
   *
   * Operations without `@defer` are returned unchanged.
   */
  export type Complete<TData> =
    TData extends any ?
      true extends IsAny<TData> ? TData
      : TData extends object ?
        true extends ContainsNeverishFields<TData> ?
          RemoveNeverishFields<TData>
        : TData
      : TData
    : never;
  /**
   * Returns the streaming representation of `TData` when `dataState` is
   * `"streaming"`.
   *
   * @remarks
   * GraphQLCodegen assembles the type in the streaming format so this is an
   * identity type.
   */
  export type Streaming<TData> = TData;

  /**
   * Returns the partial representation of `TData` when `dataState` is
   * `"partial"`.
   *
   * @remarks
   * Applies `DeepPartial` to the assembled `Complete` type so
   * `returnPartialData` does not preserve deferred `{ field?: never }` types.
   */
  export type Partial<TData> = DeepPartial<Complete<TData>>;
}
