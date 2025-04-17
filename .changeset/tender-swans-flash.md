---
"@apollo/client": major
---

Remove `loading`, `networkStatus`, and `partial` properties on all promise-based query APIs. These properties were mostly static and were unnecessary since promise resolution guaranteed that the query was not longer loading.

This affects the following APIs:
- `client.query`
- `client.refetchQueries`
- `client.reFetchObservableQueries`
- `client.resetStore`
- `observableQuery.fetchMore`
- `observableQuery.refetch`
- `observableQuery.reobserve`
- `observableQuery.setVariables`
- The `useLazyQuery` `execute` function
