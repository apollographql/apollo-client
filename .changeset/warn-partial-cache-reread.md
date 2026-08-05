---
"@apollo/client": patch
---

Add a development-only warning when a network result is written to the cache but reading the query back from the cache returns a partial result. This usually points at a `merge` or `read` function that did not repair missing fields in the cache, which prevents Apollo Client from applying the cache result to the data received by the network.
