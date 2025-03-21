---
"@apollo/client": minor
---

`ssrMode`, `ssrForceFetchDelay` and `disableNetworkFetches` have been reworked:

Previously, a `ObservableQuery` created by `client.query` or `client.watchQuery`
while one of those were active would permanently be changed from a `fetchPolicy`
of `"network-only"` or `"cache-and-network"` to `"cache-first"`, and stay that way
even long after `disableNetworkFetches` would have been deactivated.

Now, the `ObservableQuery` will keep their original `fetchPolicy`, but queries
made during `disableNetworkFetches` will just apply the `fetchPolicy` replacement
at request time, just for that one request.
