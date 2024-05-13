---
"@apollo/client": patch
---

Create branded `QueryRef` type without exposed properties.

This change deprecates `QueryReference` in favor of a `QueryRef` type that doesn't expose any properties.
This change also updates `preloadQuery` to return a new `PreloadedQueryRef` type which exposes the `toPromise` function as it does today. This means that query refs produced by `useBackgroundQuery` and `useLoadableQuery` now return `QueryRef` types which do not have access to a `toPromise` function, which was never meant to be used with in combination with these hooks.

While we tend to avoid any types of breaking changes in patch releases as this, this change was warranted to support an upcoming version of the React Server Component integration which needed to omit the `toPromise` function that would otherwise have broken at runtime.
