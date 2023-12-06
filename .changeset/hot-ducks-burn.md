---
"@apollo/client": patch
---

Add a `resetCache` method to `DocumentTransform` and hook `InMemoryCache.addTypenameTransform` up to `InMemoryCache.gc`
