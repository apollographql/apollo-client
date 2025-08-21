---
"@apollo/client": major
_tags:
  - removals
---

Remove `resetResultIdentities` option from `InMemoryCache.gc()`. This affected object canonization which has been removed.
