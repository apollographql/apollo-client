---
"@apollo/client": minor
---

Fixes an issue where cache feuds between queries selecting incompatible non-normalized data could return untransformed network values.

Apollo Client now always writes network results to the cache before delivering them, ensuring custom scalars and field `read` functions are applied. To prevent repeated refetches when competing queries repeatedly make each other's cache results incomplete, Apollo Client stops automatically refetching a query after it sees the same incomplete result again.

This may add one network request in these cache-feud scenarios.
