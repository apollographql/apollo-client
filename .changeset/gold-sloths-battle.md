---
"@apollo/client": major
---

Unsubscribing from an `ObservableQuery` before a value has been emitted will remove the query from the tracked list of queries and will no longer be eligible for query deduplication.
