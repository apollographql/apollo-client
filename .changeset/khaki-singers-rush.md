---
"@apollo/client": patch
---

Fix an issue where `network-only` incremental queries could cause cache data to leak into the emitted result when a `@defer` or `@stream` boundary had partial or complete data in the cache. Cache data inside pending `@defer` objects and `@stream` arrays are now pruned so that only completed `@defer` or `@stream` boundaries are returned.

NOTE: This change only applies to `InMemoryCache` when using `GraphQL17Alpha9Handler`.
