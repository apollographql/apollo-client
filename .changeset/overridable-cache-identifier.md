---
"@apollo/client": minor
---

Allow overriding the `from` input of `useFragment`, `useSuspenseFragment`, `readFragment`, `writeFragment` and related fragment APIs via a new `CacheIdentifier` key on the `TypeOverrides` interface.

By default, `from` continues to accept `StoreObject | Reference | FragmentType<TData> | string`. Apps can now supply a stricter policy (for example, requiring `__typename` and disallowing nullish identifier values) without affecting `StoreObject`, `cache.identify`, `cache.modify` or optimistic writes.

```ts
// apollo.d.ts
import "@apollo/client";
import type { HKT, StoreValue } from "@apollo/client/utilities";

type StrictFrom =
  | {
      __typename: string;
      // `& {}` forces values to be "defined" so an explicit `undefined`
      // (as well as `null`) is rejected.
      [key: string]: Exclude<StoreValue, null | undefined> & {};
    }
  | { __ref: string }
  | string
  | null;

interface StrictFromHKT extends HKT {
  arg1: unknown; // TData (unused)
  return: StrictFrom;
}

declare module "@apollo/client" {
  export interface TypeOverrides {
    CacheIdentifier: StrictFromHKT;
  }
}
```
