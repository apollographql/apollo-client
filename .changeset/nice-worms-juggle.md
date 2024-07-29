---
"@apollo/client": patch
---

Fix issue where `fetchMore` would write it's result data to the cache when using it with a `no-cache` fetch policy.
