---
"@apollo/client": major
---

`ObservableQuery`s will now only be registered with the `ApolloClient` while they
have subscribers.

That means that `ApolloClient.getObservableQueries` and `ApolloClient.refetchQueries`
will only be able to return/refetch queries that have at least one subscriber.

This changes the previous meaning of `active` and `inactive` queries:
* `inactive` queries are queries with a subscriber that are skipped from a
  React hook or have a `fetchPolicy` of `standby`
* `active` queries are queries with at least one subscriber that are not skipped or in `standby`.

`ObservableQuery`s without subscribers but with an active ongoing network request
(e.g. caused by calling `reobserve`) will be handled as if they had a subscriber
for the duration of the query.
