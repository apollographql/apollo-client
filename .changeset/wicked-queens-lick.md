---
"@apollo/client": major
---

`ApolloClient.stop()` now cleans up more agressively to prevent memory leaks:

* it will now unsubscribe all active `ObservableQuery` instances by emitting a `completed` event.
* it will now reject all currently running queries with `"QueryManager stopped while query was in flight"`.
