---
"@apollo/client": patch
---

Fix type of `extensions` in `protocolErrors` for `ApolloError` and the `onError` link. According to the [multipart HTTP subscription protocol](https://www.apollographql.com/docs/graphos/routing/operations/subscriptions/multipart-protocol), fatal tranport errors follow the [GraphQL error format](https://spec.graphql.org/draft/#sec-Errors.Error-Result-Format) which require `extensions` to be a map as its value instead of an array.
