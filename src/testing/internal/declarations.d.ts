import { Streaming } from "@apollo/client";
import type { Defer20220824Handler } from "@apollo/client/incremental";
import type { GraphQLCodegenDataMasking } from "@apollo/client/masking";
import type { HKT } from "@apollo/client/utilities";
import { DeepPartial } from "@apollo/client/utilities";

// This type override is used in tests only so we can differentiate between
// `TData` and `Streaming<TData>` in our type tests. This file doesn't make it
// into the final build, so it doesn't affect the userland behavior of the library.

type StreamingOverride<TData> = TData & { __streaming?: true };
interface StreamingOverrideHKT extends HKT {
  return: StreamingOverride<this["arg1"]>;
}

declare module "@apollo/client" {
  export interface TypeOverrides
    extends GraphQLCodegenDataMasking.TypeOverrides,
      Defer20220824Handler.TypeOverrides {
    Streaming: StreamingOverrideHKT;
  }
}
