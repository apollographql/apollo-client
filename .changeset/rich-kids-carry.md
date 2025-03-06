---
"@apollo/client": major
---

Fix type of `data` property on `ApolloQueryResult`. Previously this field was non-optional, non-null `TData`, however at runtime this value could be set to `undefined`. This field is now reported as `TData | undefined`.

This will affect you in a handful of places:
- The `data` property emitted from the result passed to the `next` callback from `client.watchQuery`
- Fetch-based APIs that return an `ApolloQueryResult` type such as `observableQuery.refetch`, `observableQuery.fetchMore`, etc.
