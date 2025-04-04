---
"@apollo/client": major
---

Remove `resetResultIdentities` option from `InMemoryCache.gc()`. This affected object canonization which has been removed.
