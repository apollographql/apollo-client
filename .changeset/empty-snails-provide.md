---
"@apollo/client": patch
---

Fix accidental widening of the `client.mutate` return type when `optimisticResponse` was present.
