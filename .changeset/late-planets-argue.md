---
"@apollo/client": patch
---

Create branded `QueryRef` type without exposed properties.

This change deprecates `QueryReference` in favor of a `QueryRef` type that doesn't expose any properties.
Also adds a `PreloadedQueryRef` type for `preloadQuery` that still exposes `toPromise`.
