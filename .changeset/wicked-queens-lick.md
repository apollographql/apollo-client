---
"@apollo/client": major
_tags:
  - ApolloClient
---

`ApolloClient.stop()` now cleans up more agressively to prevent memory leaks:

* It will now unsubscribe all active `ObservableQuery` instances by emitting a `completed` event.
* It will now reject all currently running queries with `"QueryManager stopped while query was in flight"`.
* It will remove all queryRefs from the suspense cache.
