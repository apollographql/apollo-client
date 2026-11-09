---
"@apollo/client": patch
---

Add a new option, `batchHybridRequests` to `BatchHttpLink`. This allows it to combine persisted and non-persisted queries in one shared batch.
