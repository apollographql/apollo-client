---
"@apollo/client": patch
---

`ssrMode`, `ssrForceFetchDelay` or `prioritizeCacheValues` should not override `fetchPolicy: 'standby'`, `skip: true`, or `skipToken`.
