---
"@apollo/client": patch
---

Fixes an issue where the wrong `networkStatus` and `loading` value was emitted from `observableQuery` when calling `fetchMore` with a `no-cache` fetch policy. The `networkStatus` now properly reports as `ready` and `loading` as `false` after the result is returned.
