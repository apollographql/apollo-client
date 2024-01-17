---
"@apollo/client": patch
---

Fix `networkStatus` with `useSuspenseQuery` not properly updating to ready state when using a `cache-and-network` fetch policy that returns data equal to what is already in the cache.
