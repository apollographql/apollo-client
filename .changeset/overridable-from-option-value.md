---
"@apollo/client": minor
---

Allow overriding the `from` input of `useFragment`, `useSuspenseFragment`, `readFragment`, `writeFragment` and related fragment APIs via a new `FromOptionValue` key on the `TypeOverrides` interface.

By default, `from` continues to accept `StoreObject | Reference | FragmentType<TData> | string`. Apps can now supply a stricter policy (for example, requiring `__typename` and disallowing nullish identifier values) without affecting `StoreObject`, `cache.identify`, `cache.modify` or optimistic writes.

```ts
// apollo.d.ts
import "@apollo/client";
import type { HKT, StoreValue } from "@apollo/client/utilities";

type StrictFrom<TData extends { __typename: string }> =
  | {
      // the `__typename` has to match the one of the fragment type
      __typename: TData["__typename"];
      // `& {}` forces values to be "defined" so an explicit `undefined`
      // (as well as `null`) is rejected.
      [key: string]: Exclude<StoreValue, null | undefined> & {};
    }
  | { __ref: string }
  | string
  | null;

interface StrictFromHKT extends HKT {
  arg1: { __typename: string }; // TData
  return: StrictFrom<this["arg1"]>;
}

declare module "@apollo/client" {
  export interface TypeOverrides {
    FromOptionValue: StrictFromHKT;
  }
}
```
