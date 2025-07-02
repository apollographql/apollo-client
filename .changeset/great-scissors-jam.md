---
"@apollo/client": major
_tags:
  - ObservableQuery
  - network_status
  - fetch_policy
  - useQuery
---

`cache-only` queries will now initialize with `loading: false` and `networkStatus: NetworkStatus.ready` when there is no data in the cache.

This means `useQuery` will no longer render a short initial loading state before rendering `loading: false` and `ObservableQuery.getCurrentResult()` will now return `loading: false` immediately.
