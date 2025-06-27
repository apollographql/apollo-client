---
"@apollo/client": major
---

Added a new `Streaming` type that will mark `data` in results while `dataStatus`
is `"streaming"`.

`Streaming<TData>` defaults to `TData`, but can be overwritten in userland to
integrate with different codegen dialects.

You can override this type globally - this example shows how to override it
with `DeepPartial<TData>`:
```ts
import { HKT, DeepPartial } from "@apollo/client/utilities";

type StreamingOverride<TData> = DeepPartial<TData>;

interface StreamingOverrideHKT extends HKT {
  return: StreamingOverride<this["arg1"]>;
}

declare module "@apollo/client" {
  export interface TypeOverrides {
    Streaming: StreamingOverrideHKT;
  }
}
```
