---
"@apollo/client": major
_tags:
  - ObservableQuery
  - removals
---

`ObservableQuery` no longer has a `queryId` property.
`ApolloClient.getObservableQueries` no longer returns a `Map<string, ObservableQuery>`, but a `Set<ObservableQuery>`.
