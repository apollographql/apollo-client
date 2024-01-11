---
'@apollo/client': minor
---

Remove the need to call `retain` from `useBackgroundQuery` since `useReadQuery` will now retain the query. This means that a `queryRef` that is not consumed by `useReadQuery` within the given `autoDisposeTimeoutMs` will now be auto diposed for you.

Thanks to [#11412](https://github.com/apollographql/apollo-client/pull/11412), disposed query refs will be automatically resubscribed to the query when consumed by `useReadQuery` after it has been disposed.
