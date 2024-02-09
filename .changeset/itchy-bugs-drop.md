---
"@apollo/client": patch
---

Fixes an issue where executing a query with a fetch policy of `network-only` multiple times with `useLazyQuery` that returned errors would return `{}` instead of `undefined` as the value of `data` after the first fetch.
