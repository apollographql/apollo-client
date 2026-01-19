---
"@apollo/client": patch
---

`ssrMode`, `ssrForceFetchDelay` or `prioritizeCacheValues` should not override `fetchPolicy: 'no-cache'`.
