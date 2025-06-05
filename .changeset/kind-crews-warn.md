---
"@apollo/client": major
---

`ObservableQuery` no longer has a `queryId` property.
`ApolloClient.getObservableQueries` no longer returns a `Map<queryId, ObservableQuery>`, but a `Set<ObservableQuery>`.
