---
"@apollo/client": patch
---

`ssrMode`, `ssrForceFetchDelay` or `prioritizeCacheValues` should not override `fetchPolicy: 'cache-only'`, `fetchPolicy: 'no-cache'`, `fetchPolicy: 'standby'`, `skip: true`, or `skipToken` when reading the initial value of an `ObservableQuery`.
