---
"@apollo/client": minor
_tags:
  - ObservableQuery
  - useLazyQuery
---

`ObservableQuery.refetch` and `ObservableQuery.reobserve` and the `execute` function of `useLazyQuery` now return a
`ResultPromise` with an additional `.retain` method.
If this method is called, the underlying network operation will be kept running even if the `ObservableQuery` itself does
not require the result anymore, and the Promise will resolve with the final result instead of resolving with an intermediate
result in the case of early cancellation.
