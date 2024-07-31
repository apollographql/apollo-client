---
"@apollo/client": patch
---

Fix an issue where `fetchMore` would write its result data to the cache when using it with a `no-cache` fetch policy.
