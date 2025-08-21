---
"@apollo/client": major
_tags:
  - errors
  - removals
  - ObservableQuery
  - client.watchQuery
  - client.query
  - useQuery
  - useLazyQuery
---

Remove the `errors` property from the results emitted from `ObservableQuery` or returned from `client.query`. Read errors from the `error` property instead.
