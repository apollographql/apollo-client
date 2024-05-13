---
"@apollo/client": patch
---

Create branded `QueryRef` type without exposed properties.

This change deprecates `QueryReference` in favor of a `QueryRef` type that doesn't expose any properties.
This change also updates `preloadQuery` to return a new `PreloadedQueryRef` type, which exposes the `toPromise` function as it does today. This means that query refs produced by `useBackgroundQuery` and `useLoadableQuery` now return `QueryRef` types that do not have access to a `toPromise` function, which was never meant to be used in combination with these hooks.

While we tend to avoid any types of breaking changes in patch releases as this, this change was necessary to support an upcoming version of the React Server Component integration, which needed to omit the `toPromise` function that would otherwise have broken at runtime.
Note that this is a TypeScript-only change. At runtime, `toPromise` is still present on all queryRefs currently created by this package - but we strongly want to discourage you from accessing it in all cases except for the `PreloadedQueryRef` use case.

Migration is as simple as replacing all references to `QueryReference` with `QueryRef`, so it should be possible to do this with a search & replace in most code bases:

```diff
-import { QueryReference } from '@apollo/client'
+import { QueryRef } from '@apollo/client'

- function Component({ queryRef }: { queryRef: QueryReference<TData> }) {
+ function Component({ queryRef }: { queryRef: QueryRef<TData> }) {
  // ...
}
```
