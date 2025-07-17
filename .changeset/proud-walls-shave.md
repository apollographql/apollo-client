---
"@apollo/client": minor
_tags:
  - types
  - dataState
---

Overridable types for `dataState: "complete"`, `dataState: "streaming"` and
`dataState: "partial"` responses.

This adds the `DataValue` namespace exported from Apollo Client with the three
types `DataValue.Complete`, `DataValue.Streaming` and `DataValue.Partial`.

These types will be used to mark `TData` in the respective states.

* `Complete` defaults to `TData`
* `Streaming` defaults to `TData`
* `Partial` defaults to `DeepPartial<TData>`

All three can be overwritten, e.g. to be `DeepReadonly` using higher kinded types
by following this pattern:

```ts
import { HKT, DeepPartial } from "@apollo/client/utilities";
import { DeepReadonly } from "some-type-helper-library";

interface CompleteOverride extends HKT {
  return: DeepReadonly<this["arg1"]>;
}

interface StreamingOverride extends HKT {
  return: DeepReadonly<this["arg1"]>;
}

interface PartialOverride extends HKT {
  return: DeepReadonly<DeepPartial<this["arg1"]>>;
}

declare module "@apollo/client" {
  export interface TypeOverrides {
    Complete: CompleteOverride;
    Streaming: StreamingOverride;
    Partial: PartialOverride;
  }
}
```
